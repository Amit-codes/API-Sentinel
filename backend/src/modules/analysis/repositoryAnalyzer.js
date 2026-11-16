import ts from 'typescript';

const routeMethods = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'all']);
const sourceExtensions = /\.(?:[cm]?[jt]sx?)$/i;
const testPathPattern = /(?:^|\/)(?:__tests__|tests?|specs?)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/i;
const pathCandidates = (base) => [base, ...['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.mts', '.cts', '/index.js', '/index.jsx', '/index.ts', '/index.tsx'].map((ext) => `${base}${ext}`)];

function sourceKind(path) {
  if (testPathPattern.test(path)) return 'test';
  if (/^(?:jest|vitest|babel|webpack|vite|eslint|prettier|tsconfig)\.|(?:^|\/)(?:config|configs)\//i.test(path)) return 'configuration';
  return 'application';
}

function languageFor(path) {
  if (path.endsWith('.json')) return 'json';
  return /\.[cm]?tsx?$|\.(?:mts|cts)$/i.test(path) ? 'typescript' : 'javascript';
}

function scriptKind(path) {
  if (/\.tsx$/i.test(path)) return ts.ScriptKind.TSX;
  if (/\.[cm]?ts$|\.(?:mts|cts)$/i.test(path)) return ts.ScriptKind.TS;
  return ts.ScriptKind.JSX;
}

function literalValue(node) {
  if (!node) return null;
  if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return null;
}

function expressionName(node) {
  if (!node) return null;
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return `${expressionName(node.expression)}.${node.name.text}`;
  if (ts.isCallExpression(node)) return expressionName(node.expression);
  return null;
}

function stableRoutePath(value) {
  if (!value) return null;
  if (!value.startsWith('/')) return `/${value}`;
  return value;
}

function joinRoutePaths(prefix, route) {
  const left = prefix === '/' ? '' : prefix.replace(/\/$/, '');
  const right = route === '/' ? '' : route.startsWith('/') ? route : `/${route}`;
  return `${left}${right}` || '/';
}

function layer(path) {
  const value = path.toLowerCase();
  if (/route/.test(value)) return 'route';
  if (/controller/.test(value)) return 'controller';
  if (/service/.test(value)) return 'service';
  if (/model|schema/.test(value)) return 'model';
  return 'other';
}

function resolveImport(fromPath, specifier, paths) {
  if (!specifier?.startsWith('.')) return null;
  const directory = fromPath.includes('/') ? fromPath.slice(0, fromPath.lastIndexOf('/') + 1) : '';
  const segments = `${directory}${specifier}`.split('/');
  const normalized = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') normalized.pop();
    else normalized.push(segment);
  }
  return pathCandidates(normalized.join('/')).find((candidate) => paths.has(candidate)) || null;
}

function callCalleeName(node) {
  return ts.isCallExpression(node) ? expressionName(node.expression) : null;
}

function findExpressionIdentifiers(node, output = new Set()) {
  if (!node) return output;
  if (ts.isIdentifier(node)) output.add(node.text);
  else if (ts.isPropertyAccessExpression(node)) {
    const name = expressionName(node);
    if (name) output.add(name);
  } else if (ts.isArrayLiteralExpression(node)) node.elements.forEach((element) => findExpressionIdentifiers(element, output));
  else if (ts.isCallExpression(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    if (ts.isCallExpression(node)) output.add(expressionName(node.expression) || '');
    if (node.body) findExpressionIdentifiers(node.body, output);
  }
  return output;
}

function handlerReferenceNames(node) {
  if (ts.isArrayLiteralExpression(node)) return node.elements.flatMap(handlerReferenceNames);
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return ['inline handler'];
  return [expressionName(node)].filter(Boolean);
}

function parseSource(path, text) {
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKind(path));
  const diagnostics = (file.parseDiagnostics || []).slice(0, 10).map((item) => {
    const position = item.start == null ? null : file.getLineAndCharacterOfPosition(item.start);
    const message = ts.flattenDiagnosticMessageText(item.messageText, ' ');
    return `${position ? `line ${position.line + 1}: ` : ''}${message.slice(0, 240)}`;
  });
  return { file, diagnostics };
}

function analyzeFile(path, text, paths, warnings) {
  const { file, diagnostics } = parseSource(path, text);
  const imports = [];
  const symbols = new Set();
  const appRouters = new Set();
  const routerNames = new Set();
  const importedBindings = new Map();
  const calls = [];

  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const moduleSpecifier = literalValue(node.moduleSpecifier);
      if (moduleSpecifier) {
        const target = resolveImport(path, moduleSpecifier, paths);
        if (target) {
          imports.push({ fromPath: path, toPath: target, specifier: moduleSpecifier, relationType: 'imports', confidence: 'high' });
          if (ts.isImportDeclaration(node) && node.importClause) {
            const bindings = node.importClause.namedBindings;
            if (node.importClause.name) importedBindings.set(node.importClause.name.text, target);
            if (bindings && ts.isNamedImports(bindings)) bindings.elements.forEach((element) => importedBindings.set(element.name.text, target));
            if (bindings && ts.isNamespaceImport(bindings)) importedBindings.set(bindings.name.text, target);
          }
        }
      }
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isCallExpression(node.initializer)) {
      const name = node.name.text;
      const callee = callCalleeName(node.initializer) || '';
      if (callee === 'express.Router' || callee === 'Router') routerNames.add(name);
      if (callee === 'express') appRouters.add(name);
    }
    if (ts.isFunctionDeclaration(node) && node.name) symbols.add(node.name.text);
    if (ts.isClassDeclaration(node) && node.name) symbols.add(node.name.text);
    if (ts.isMethodDeclaration(node) && node.name) symbols.add(node.name.getText(file));
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) symbols.add(node.name.text);
    }
    if (ts.isCallExpression(node)) calls.push(node);
    ts.forEachChild(node, visit);
  }
  visit(file);

  if (path.split('/').at(-1)?.toLowerCase().startsWith('app.')) appRouters.add('app');
  const dependencies = [...imports];
  const routes = [];
  const mounts = [];
  const ownedRouterName = (name) => name && (appRouters.has(name) || routerNames.has(name) || /(?:app|router|routes?)$/i.test(name));

  for (const call of calls) {
    const expression = call.expression;
    if (!ts.isPropertyAccessExpression(expression)) continue;
    const method = expression.name.text.toLowerCase();
    const object = expression.expression;
    if (method === 'use' && ts.isIdentifier(object) && ownedRouterName(object.text)) {
      const args = [...call.arguments];
      let prefix = '/';
      if (args.length && (ts.isStringLiteralLike(args[0]) || ts.isNoSubstitutionTemplateLiteral(args[0]))) prefix = stableRoutePath(literalValue(args.shift()));
      else if (args.length && !ts.isIdentifier(args[0]) && !ts.isArrayLiteralExpression(args[0])) {
        const laterRouter = args.slice(1).some((argument) => ts.isIdentifier(argument) && routerNames.has(argument.text));
        if (laterRouter) {
          const line = file.getLineAndCharacterOfPosition(call.getStart(file)).line + 1;
          warnings.push(`${path}:${line}: dynamic Express mount path could not be resolved.`);
          prefix = null;
        }
      }
      for (const target of args) {
        if (ts.isIdentifier(target) && routerNames.has(target.text)) mounts.push({ parentName: object.text, routerName: target.text, prefix });
      }
      continue;
    }

    let routeNode = call;
    let routeObject = object;
    let routeMethod = method;
    let routeArguments = [...call.arguments];
    if (!routeMethods.has(routeMethod)) continue;
    if (ts.isCallExpression(object) && ts.isPropertyAccessExpression(object.expression) && object.expression.name.text === 'route') {
      routeNode = object;
      routeObject = object.expression.expression;
      routeArguments = [...call.arguments];
    }
    if (!ts.isIdentifier(routeObject) || !ownedRouterName(routeObject.text)) continue;

    let routePath = literalValue(routeNode.arguments?.[0]);
    if (routeNode !== call && routePath === null) routePath = literalValue(routeNode.arguments?.[0]);
    const handlerArguments = routeNode === call ? routeArguments.slice(1) : routeArguments;
    const location = file.getLineAndCharacterOfPosition(call.getStart(file));
    const handlerNames = [...new Set(handlerArguments.flatMap(handlerReferenceNames))];
    const middlewareNames = handlerNames.length > 1 ? handlerNames.slice(0, -1) : [];
    const controllerFiles = [...new Set(handlerNames.map((name) => importedBindings.get(name.split('.')[0])).filter(Boolean))];
    for (const controllerFile of controllerFiles) {
      dependencies.push({ fromPath: path, toPath: controllerFile, specifier: null, relationType: 'controller_route', symbol: handlerNames.find((name) => importedBindings.get(name) === controllerFile), confidence: 'high' });
    }
    const unsupportedReasons = [];
    if (!routePath) {
      unsupportedReasons.push('Route path is computed dynamically.');
      warnings.push(`${path}:${location.line + 1}: dynamic Express route path was not expanded.`);
    }
    routes.push({
      method: routeMethod.toUpperCase(), routePath: routePath == null ? null : stableRoutePath(routePath), routerName: routeObject.text,
      line: location.line + 1, middlewareNames, handlerNames, controllerFiles, unsupportedReasons,
      confidence: routePath == null ? 'low' : controllerFiles.length ? 'high' : 'medium',
    });
  }

  const importsBySymbol = new Map();
  for (const [symbol, target] of importedBindings) importsBySymbol.set(symbol, target);
  const localSymbols = new Set(symbols);
  for (const call of calls) {
    const targetName = ts.isIdentifier(call.expression) ? call.expression.text : ts.isPropertyAccessExpression(call.expression) ? call.expression.name.text : null;
    if (targetName && localSymbols.has(targetName)) dependencies.push({ fromPath: path, toPath: path, specifier: null, relationType: 'calls_function', symbol: targetName, confidence: 'medium' });
    else if (targetName && importsBySymbol.has(targetName)) dependencies.push({ fromPath: path, toPath: importsBySymbol.get(targetName), specifier: null, relationType: 'calls_function', symbol: targetName, confidence: 'medium' });
  }
  return { path, text, file, diagnostics, symbols: [...symbols].slice(0, 200), imports, dependencies, routes, mounts, routerNames: [...routerNames], appRouters: [...appRouters], importedBindings };
}

function resolveMountedRoutes(parsedFiles, warnings) {
  const mountsByRouter = new Map();
  const directRoutes = new Map();
  const appNames = new Set();
  for (const file of parsedFiles) {
    file.appRouters.forEach((name) => appNames.add(name));
    for (const route of file.routes) {
      const key = `${file.path}::${route.routerName}`;
      if (!directRoutes.has(key)) directRoutes.set(key, []);
      directRoutes.get(key).push({ ...route, routeFile: file.path });
    }
    for (const mount of file.mounts) {
      if (!mountsByRouter.has(mount.routerName)) mountsByRouter.set(mount.routerName, []);
      mountsByRouter.get(mount.routerName).push({ ...mount, filePath: file.path });
    }
  }

  const endpoints = [];
  function appPrefixes(routerName, visited = new Set()) {
    if (appNames.has(routerName)) return [{ prefixes: [], appRouter: routerName }];
    if (visited.has(routerName)) return [];
    const nextVisited = new Set(visited).add(routerName);
    const edges = mountsByRouter.get(routerName) || [];
    return edges.flatMap((edge) => appPrefixes(edge.parentName, nextVisited).map((result) => ({
      ...result,
      prefixes: [...result.prefixes, edge.prefix],
    })));
  }
  for (const [key, routes] of directRoutes) {
    const [, routerName] = key.split('::');
    const mountPaths = appPrefixes(routerName);
    for (const route of routes) {
      for (const mountPath of mountPaths) {
        const dynamicPrefix = mountPath.prefixes.some((prefix) => prefix === null);
        endpoints.push({
          ...route,
          path: route.routePath && !dynamicPrefix ? [...mountPath.prefixes].reverse().reduce((path, prefix) => joinRoutePaths(prefix, path), route.routePath) : null,
          unsupportedReasons: dynamicPrefix ? [...route.unsupportedReasons, 'Router is mounted under a dynamic prefix.'] : route.unsupportedReasons,
          confidence: dynamicPrefix ? 'low' : route.confidence,
        });
      }
    }
  }
  if (!endpoints.length && parsedFiles.some((file) => file.routes.length)) warnings.push('Express route registrations were found, but no statically identifiable app entry point or router mount connected them.');
  const unique = new Map();
  for (const endpoint of endpoints) unique.set([endpoint.method, endpoint.path, endpoint.routeFile, endpoint.line].join('|'), endpoint);
  return [...unique.values()].sort((a, b) => `${a.path || ''}${a.method}`.localeCompare(`${b.path || ''}${b.method}`));
}

function testMetadata(file) {
  const suites = [];
  const cases = [];
  const requests = [];
  let hasSupertest = /from\s*['"]supertest['"]|require\s*\(\s*['"]supertest['"]\s*\)/.test(file.text);
  function visit(node) {
    if (ts.isImportDeclaration(node) && literalValue(node.moduleSpecifier) === 'supertest') hasSupertest = true;
    if (ts.isCallExpression(node)) {
      const callee = expressionName(node.expression) || '';
      const args = [...node.arguments];
      const label = literalValue(args[0]);
      if (label && /^(?:describe|suite|describe\.each)$/i.test(callee)) suites.push(label);
      if (label && /^(?:it|test|it\.each|test\.each|it\.only|test\.only|it\.skip|test\.skip)$/i.test(callee)) cases.push(label);
      const requestMethod = callee.match(/\.(get|post|put|patch|delete|head|options)$/i)?.[1]?.toUpperCase();
      const requestPath = requestMethod && args.length ? literalValue(args[0]) : null;
      if (requestMethod && requestPath) requests.push({ method: requestMethod, path: requestPath, evidence: `${callee}('${requestPath}')` });
    }
    ts.forEachChild(node, visit);
  }
  visit(file.file);
  return { suites: [...new Set(suites)].slice(0, 100), cases: [...new Set(cases)].slice(0, 300), hasSupertest, requests };
}

function packageMetadata(files, treePaths) {
  const packagePaths = treePaths.filter((path) => /(?:^|\/)package\.json$/i.test(path) && files.has(path));
  const candidatePackages = packagePaths.map((path) => {
    const directory = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '.';
    const sourceCount = treePaths.filter((sourcePath) => sourceExtensions.test(sourcePath) && (directory === '.' || sourcePath.startsWith(`${directory}/`))).length;
    return { path, directory, sourceCount };
  });
  const packagePath = packagePaths.includes('package.json') ? 'package.json' : candidatePackages.sort((a, b) => b.sourceCount - a.sourceCount)[0]?.path;
  const packageFile = packagePath ? files.get(packagePath) : null;
  const packageDirectory = packagePath?.includes('/') ? packagePath.slice(0, packagePath.lastIndexOf('/')) : '.';
  let packageJson = {};
  if (packageFile) {
    try { packageJson = JSON.parse(packageFile.text); } catch { /* reported below as an analyzer warning */ }
  }
  const names = treePaths.filter((path) => packageDirectory === '.' || path.startsWith(`${packageDirectory}/`));
  const manager = names.some((path) => path === `${packageDirectory === '.' ? '' : `${packageDirectory}/`}pnpm-lock.yaml`) ? 'pnpm' : names.some((path) => path === `${packageDirectory === '.' ? '' : `${packageDirectory}/`}yarn.lock`) ? 'yarn' : names.some((path) => [ 'package-lock.json', 'npm-shrinkwrap.json' ].some((lockfile) => path === `${packageDirectory === '.' ? '' : `${packageDirectory}/`}${lockfile}`)) ? 'npm' : 'unknown';
  const jestConfigs = names.filter((path) => /(?:^|\/)(?:jest\.config\.[^/]+|jest\.setup\.[^/]+)$/i.test(path));
  const vitestConfigs = names.filter((path) => /(?:^|\/)(?:vitest\.config\.[^/]+)$/i.test(path));
  const hasJest = Boolean(packageJson.devDependencies?.jest || packageJson.dependencies?.jest || jestConfigs.length);
  const hasVitest = Boolean(packageJson.devDependencies?.vitest || packageJson.dependencies?.vitest || vitestConfigs.length);
  const testScript = typeof packageJson.scripts?.test === 'string' ? packageJson.scripts.test : '';
  const scriptFramework = /\bvitest\b/i.test(testScript) ? 'vitest' : /\bjest\b/i.test(testScript) ? 'jest' : null;
  const testFramework = hasJest && hasVitest ? scriptFramework : hasVitest ? 'vitest' : hasJest ? 'jest' : null;
  const sourcePaths = names.filter((path) => sourceExtensions.test(path));
  return {
    name: typeof packageJson.name === 'string' ? packageJson.name : null,
    packageDirectory,
    packageManager: manager,
    scripts: packageJson.scripts && typeof packageJson.scripts === 'object' ? packageJson.scripts : {},
    sourceFileCount: sourcePaths.length,
    applicationFileCount: sourcePaths.filter((path) => sourceKind(path) === 'application').length,
    testFileCount: sourcePaths.filter((path) => sourceKind(path) === 'test').length,
    testDirectories: [...new Set(sourcePaths.filter((path) => sourceKind(path) === 'test').map((path) => path.split('/').slice(0, -1).join('/') || '.'))].slice(0, 100),
    jestConfigFiles: jestConfigs,
    jestDetected: hasJest,
    vitestConfigFiles: vitestConfigs,
    vitestDetected: hasVitest,
    testFramework,
    supertestDetected: sourcePaths.some((path) => /supertest/.test(files.get(path)?.text || '')) || Boolean(packageJson.devDependencies?.supertest || packageJson.dependencies?.supertest),
    entryPoints: sourcePaths.filter((path) => /(?:^|\/)(?:app|server|index|main)\.[cm]?[jt]sx?$/i.test(path) || (packageJson.main && path === packageJson.main)).slice(0, 100),
  };
}

function mapTestToEndpoint(testFile, endpoint) {
  for (const request of testFile.requests) {
    if (request.method !== endpoint.method || !endpoint.path) continue;
    const endpointPattern = endpoint.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z_$][\w$]*/g, '[^/]+');
    try {
      if (new RegExp(`^${endpointPattern}/?$`).test(request.path)) return { evidence: request.evidence, confidence: 'high' };
    } catch { /* leave dynamic/unsupported patterns unmapped */ }
  }
  return null;
}

export function analyzeRepositoryFiles(files, { sourceFileCount = files.size, treePaths = [...files.keys()], truncated = false } = {}) {
  const warnings = [];
  if (truncated) warnings.push(`Repository inspection was bounded to ${files.size} files of ${sourceFileCount}; results may be incomplete.`);
  if (!files.has('package.json')) warnings.push('No root package.json was found; project scripts and dependencies may be incomplete.');
  else {
    try { JSON.parse(files.get('package.json').text); }
    catch { warnings.push('The root package.json could not be parsed; package scripts and dependencies may be incomplete.'); }
  }
  const project = packageMetadata(files, treePaths);
  if (!project.jestDetected && !project.vitestDetected) warnings.push('Jest or Vitest configuration or dependency was not identified.');
  if (!project.supertestDetected) warnings.push('Supertest usage or dependency was not identified.');

  const parsedFiles = [];
  const sourceFileRecords = [];
  for (const [path, entry] of files) {
    if (path.endsWith('.json')) {
      sourceFileRecords.push({ path, blobSha: entry.sha, language: 'json', kind: 'configuration', symbols: [], parseDiagnostics: [] });
      continue;
    }
    if (!sourceExtensions.test(path)) continue;
    const parsed = analyzeFile(path, entry.text, new Set(files.keys()), warnings);
    parsedFiles.push(parsed);
    if (parsed.diagnostics.length) warnings.push(...parsed.diagnostics.slice(0, 3).map((diagnostic) => `${path}: ${diagnostic}`));
    sourceFileRecords.push({ path, blobSha: entry.sha, language: languageFor(path), kind: sourceKind(path), symbols: parsed.symbols, parseDiagnostics: parsed.diagnostics });
  }

  const endpoints = resolveMountedRoutes(parsedFiles, warnings);
  const dependencies = [];
  const dependencyKeys = new Set();
  for (const file of parsedFiles) {
    for (const edge of file.dependencies) {
      const relationType = edge.relationType === 'imports'
        ? ({ controller: 'controller', service: 'service', model: 'model', route: 'route' }[layer(edge.fromPath)] === 'controller' && layer(edge.toPath) === 'service'
          ? 'controller_service' : layer(edge.fromPath) === 'service' && layer(edge.toPath) === 'model' ? 'service_model' : edge.relationType)
        : edge.relationType;
      const result = { ...edge, relationType };
      const key = `${result.fromPath}|${result.toPath}|${result.relationType}|${result.symbol || ''}`;
      if (!dependencyKeys.has(key)) { dependencyKeys.add(key); dependencies.push(result); }
    }
    for (const mount of file.mounts) {
      const routerFile = parsedFiles.find((candidate) => candidate.routerNames.includes(mount.routerName));
      if (routerFile && routerFile.path !== file.path) dependencies.push({ fromPath: file.path, toPath: routerFile.path, specifier: null, relationType: 'mounts_router', symbol: mount.routerName, confidence: 'medium' });
    }
  }

  const testFiles = parsedFiles.filter((file) => sourceKind(file.path) === 'test').map((file) => ({ path: file.path, framework: project.testFramework || (project.vitestDetected ? 'vitest' : project.jestDetected ? 'jest' : 'unknown'), ...testMetadata(file), parseDiagnostics: file.diagnostics }));
  const mappings = [];
  for (const endpoint of endpoints) {
    for (const test of testFiles) {
      const mapping = mapTestToEndpoint(test, endpoint);
      if (mapping) mappings.push({ endpointMethod: endpoint.method, endpointPath: endpoint.path, routeFile: endpoint.routeFile, endpointLine: endpoint.line, testFilePath: test.path, ...mapping });
    }
  }

  const summary = {
    sourceFiles: sourceFileRecords.length,
    applicationFiles: sourceFileRecords.filter((file) => file.kind === 'application').length,
    testFiles: testFiles.length,
    endpoints: endpoints.length,
    dependencies: dependencies.length,
    mappedTests: mappings.length,
    unmappedEndpoints: endpoints.filter((endpoint) => !mappings.some((mapping) => mapping.endpointMethod === endpoint.method && mapping.endpointPath === endpoint.path)).length,
    uncertainRoutes: endpoints.filter((endpoint) => endpoint.confidence === 'low').length,
  };
  return { project, summary, warnings: [...new Set(warnings)].slice(0, 200), sourceFiles: sourceFileRecords, endpoints, dependencies, testFiles, mappings };
}
