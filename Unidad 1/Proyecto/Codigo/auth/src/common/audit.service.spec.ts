import { serializeAuditEvent } from './audit.service';
describe('Audit redaction', () => {
  it('keeps traceability and drops credentials and complete tokens', () => {
    const line = serializeAuditEvent('role_assigned', {
      actorId: 'admin',
      targetUserId: 'user',
      targetRoleId: 'role',
      requestId: 'request',
      password: 'secret-value',
      privateKey: 'private-key-value',
      authorization: 'Bearer secret-token',
      path: '/api/eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature',
    });
    const record = JSON.parse(line);
    expect(record.actorId).toBe('admin');
    expect(record.targetRoleId).toBe('role');
    expect(record.timestamp).toBeDefined();
    expect(line).not.toContain('secret-value');
    expect(line).not.toContain('private-key-value');
    expect(line).not.toContain('eyJ');
  });
});
