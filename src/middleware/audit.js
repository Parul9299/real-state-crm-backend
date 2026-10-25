import AuditLog from '../models/AuditLog.js';
export async function audit(req, action, resourceType, resourceId = '') {
  try {
    await AuditLog.create({
      workspace_id: req.user.workspace_id, actor_id: req.user.id, action,
      resource_type: resourceType, resource_id: String(resourceId || ''), ip: req.ip
    });
  } catch (err) { console.error('Audit log write failed', err.message); }
}
