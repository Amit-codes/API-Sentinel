import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { GitHubInstallation } from '../../database/models/GitHubInstallation.js';
import { Repository } from '../../database/models/Repository.js';
import { User } from '../../database/models/User.js';
import { WebhookEvent } from '../../database/models/WebhookEvent.js';
import { HttpError } from '../../shared/HttpError.js';

function validSignature(rawBody, signature) {
  if (typeof signature !== 'string' || !/^sha256=[a-f\d]{64}$/i.test(signature)) return false;
  const expected = `sha256=${createHmac('sha256', env.GITHUB_WEBHOOK_SECRET).update(rawBody).digest('hex')}`;
  const suppliedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return suppliedBuffer.length === expectedBuffer.length && timingSafeEqual(suppliedBuffer, expectedBuffer);
}

async function processInstallationEvent(eventName, action, payload) {
  const installation = payload.installation;
  if (!installation?.id || !installation.account?.id || !installation.account?.login) return 'ignored_invalid_installation_payload';
  const installationId = String(installation.id);
  if (eventName === 'installation') {
    if (action === 'deleted') {
      await GitHubInstallation.updateOne({ installationId }, { $set: { status: 'deleted', suspendedAt: null } });
      await Repository.updateMany({ installationId, status: 'connected' }, { $set: { status: 'installation_removed' } });
      return 'installation_deleted';
    }
    if (action === 'suspend') {
      await GitHubInstallation.updateOne({ installationId }, { $set: { status: 'suspended', suspendedAt: new Date() } });
      return 'installation_suspended';
    }
    if (action === 'unsuspend' || action === 'created' || action === 'new_permissions_accepted') {
      const sender = payload.sender?.id ? await User.findOne({ githubId: String(payload.sender.id) }).select('_id').lean() : null;
      const values = {
        accountId: String(installation.account.id),
        accountLogin: installation.account.login,
        accountType: installation.target_type || installation.account.type || null,
        repositorySelection: installation.repository_selection === 'all' ? 'all' : 'selected',
        status: 'active',
        suspendedAt: null,
      };
      await GitHubInstallation.findOneAndUpdate(
        { installationId },
        { $set: values, ...(sender ? { $setOnInsert: { ownerUserId: sender._id } } : {}) },
        { upsert: true, runValidators: true },
      );
      return `installation_${action}`;
    }
    return 'ignored_installation_action';
  }
  if (eventName === 'installation_repositories') {
    const removedIds = (payload.repositories_removed || []).map((repo) => String(repo.id));
    if (removedIds.length) await Repository.updateMany({ installationId, githubId: { $in: removedIds }, status: 'connected' }, { $set: { status: 'installation_removed' } });
    const addedIds = (payload.repositories_added || []).map((repo) => String(repo.id));
    if (addedIds.length) await Repository.updateMany({ installationId, githubId: { $in: addedIds }, status: 'installation_removed' }, { $set: { status: 'connected' } });
    return 'installation_repositories_synchronized';
  }
  return 'ignored_installation_event';
}

async function processWebhook(eventName, action, payload) {
  if (eventName === 'installation' || eventName === 'installation_repositories') return processInstallationEvent(eventName, action, payload);
  if (eventName === 'push') {
    const installationId = payload.installation?.id ? String(payload.installation.id) : null;
    const githubId = payload.repository?.id ? String(payload.repository.id) : null;
    if (!installationId || !githubId) return 'ignored_push_without_installation_or_repository';
    const branch = typeof payload.ref === 'string' && payload.ref.startsWith('refs/heads/') ? payload.ref.slice('refs/heads/'.length) : null;
    if (!branch) return 'ignored_non_branch_push';
    const update = await Repository.updateOne(
      { installationId, githubId, status: 'connected', selectedBranch: branch },
      { $set: { lastCommitSha: typeof payload.after === 'string' && !/^0+$/.test(payload.after) ? payload.after : null, lastPushAt: new Date() } },
    );
    if (update.matchedCount) return 'push_recorded_for_monitored_branch';
    const connected = await Repository.exists({ installationId, githubId, status: 'connected' });
    return connected ? 'push_ignored_unmonitored_branch' : 'push_recorded_for_unconnected_repository';
  }
  return 'ignored_unsupported_event';
}

async function claimDelivery(deliveryId, eventName, action, payload) {
  try {
    return await WebhookEvent.create({
      deliveryId, eventName, action: action || null,
      installationId: payload.installation?.id ? String(payload.installation.id) : null,
      repositoryGithubId: payload.repository?.id ? String(payload.repository.id) : null,
      status: 'processing',
    });
  } catch (error) {
    if (error?.code !== 11000) throw error;
    const staleBefore = new Date(Date.now() - 5 * 60 * 1000);
    return WebhookEvent.findOneAndUpdate(
      { deliveryId, $or: [{ status: 'failed' }, { status: 'processing', updatedAt: { $lt: staleBefore } }] },
      { $set: { status: 'processing', outcome: null, eventName, action: action || null, receivedAt: new Date() } },
      { new: true },
    );
  }
}

export async function receiveGitHubWebhook(req, res) {
  if (!env.isGitHubAppConfigured) throw new HttpError(503, 'GITHUB_APP_NOT_CONFIGURED', 'GitHub App credentials are not configured yet.');
  if (!Buffer.isBuffer(req.body)) throw new HttpError(400, 'WEBHOOK_BODY_INVALID', 'Expected a JSON webhook body.');
  if (!validSignature(req.body, req.get('x-hub-signature-256'))) throw new HttpError(401, 'WEBHOOK_SIGNATURE_INVALID', 'GitHub webhook signature is invalid.');
  const eventName = req.get('x-github-event');
  const deliveryId = req.get('x-github-delivery');
  if (!eventName || eventName.length > 100 || !deliveryId || deliveryId.length > 100) throw new HttpError(400, 'WEBHOOK_HEADERS_INVALID', 'Required GitHub delivery headers are missing.');

  let payload;
  try { payload = JSON.parse(req.body.toString('utf8')); }
  catch { throw new HttpError(400, 'WEBHOOK_JSON_INVALID', 'The GitHub webhook payload is invalid JSON.'); }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new HttpError(400, 'WEBHOOK_JSON_INVALID', 'The GitHub webhook payload is invalid.');
  const event = await claimDelivery(deliveryId, eventName, payload.action, payload);
  if (!event) return res.status(202).json({ data: { received: true, duplicate: true } });

  try {
    event.outcome = await processWebhook(eventName, payload.action, payload);
    event.status = 'processed';
    event.processedAt = new Date();
    await event.save();
    return res.status(202).json({ data: { received: true, duplicate: false, outcome: event.outcome } });
  } catch (error) {
    event.status = 'failed';
    event.outcome = null;
    await event.save();
    throw error;
  }
}
