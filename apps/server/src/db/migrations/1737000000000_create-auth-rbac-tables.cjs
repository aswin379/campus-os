/* node-pg-migrate migration. CommonJS on purpose — keeps the migration
 * runner independent of the app's ESM module settings. */

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createExtension('pgcrypto', { ifNotExists: true });
  pgm.createExtension('citext', { ifNotExists: true });

  pgm.createTable('staff', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    full_name: { type: 'text', notNull: true },
    email: { type: 'citext', notNull: true, unique: true },
    phone: { type: 'text' },
    password_hash: { type: 'text', notNull: true },
    is_active: { type: 'boolean', notNull: true, default: true },
    is_super_admin: { type: 'boolean', notNull: true, default: false },
    last_login_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    deleted_at: { type: 'timestamptz' },
  });

  pgm.createTable('roles', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true, unique: true },
    description: { type: 'text' },
    is_system: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('permissions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    key: { type: 'text', notNull: true, unique: true },
    module: { type: 'text', notNull: true },
    description: { type: 'text' },
  });

  pgm.createTable('role_permissions', {
    role_id: { type: 'uuid', notNull: true, references: 'roles', onDelete: 'cascade' },
    permission_id: { type: 'uuid', notNull: true, references: 'permissions', onDelete: 'cascade' },
  });
  pgm.addConstraint('role_permissions', 'role_permissions_pkey', {
    primaryKey: ['role_id', 'permission_id'],
  });

  pgm.createTable('staff_roles', {
    staff_id: { type: 'uuid', notNull: true, references: 'staff', onDelete: 'cascade' },
    role_id: { type: 'uuid', notNull: true, references: 'roles', onDelete: 'cascade' },
  });
  pgm.addConstraint('staff_roles', 'staff_roles_pkey', {
    primaryKey: ['staff_id', 'role_id'],
  });

  pgm.createTable('staff_permission_overrides', {
    staff_id: { type: 'uuid', notNull: true, references: 'staff', onDelete: 'cascade' },
    permission_id: { type: 'uuid', notNull: true, references: 'permissions', onDelete: 'cascade' },
    effect: { type: 'text', notNull: true, check: "effect in ('grant', 'revoke')" },
  });
  pgm.addConstraint('staff_permission_overrides', 'staff_permission_overrides_pkey', {
    primaryKey: ['staff_id', 'permission_id'],
  });

  // connect-pg-simple's expected session table shape
  pgm.createTable('session', {
    sid: { type: 'varchar', notNull: true, primaryKey: true },
    sess: { type: 'json', notNull: true },
    expire: { type: 'timestamp(6)', notNull: true },
  });
  pgm.createIndex('session', 'expire', { name: 'idx_session_expire' });

  pgm.createTable('audit_log', {
    id: 'id',
    actor_staff_id: { type: 'uuid', references: 'staff', onDelete: 'set null' },
    action: { type: 'text', notNull: true },
    entity_type: { type: 'text', notNull: true },
    entity_id: { type: 'text', notNull: true },
    before_data: { type: 'jsonb' },
    after_data: { type: 'jsonb' },
    ip_address: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('audit_log', ['entity_type', 'entity_id']);

  pgm.createTable('settings', {
    key: { type: 'text', primaryKey: true },
    value: { type: 'jsonb' },
    updated_by: { type: 'uuid', references: 'staff', onDelete: 'set null' },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('settings');
  pgm.dropTable('audit_log');
  pgm.dropTable('session');
  pgm.dropTable('staff_permission_overrides');
  pgm.dropTable('staff_roles');
  pgm.dropTable('role_permissions');
  pgm.dropTable('permissions');
  pgm.dropTable('roles');
  pgm.dropTable('staff');
};
