-- create-auth-rbac-tables

create table staff (
  id char(36) primary key,
  full_name text not null,
  email varchar(255) collate utf8mb4_0900_ai_ci not null unique,
  phone text,
  password_hash text not null,
  is_active boolean not null default true,
  is_super_admin boolean not null default false,
  last_login_at datetime(6),
  created_at datetime(6) not null default current_timestamp(6),
  updated_at datetime(6) not null default current_timestamp(6),
  deleted_at datetime(6)
);

create table roles (
  id char(36) primary key,
  name varchar(255) not null unique,
  description text,
  is_system boolean not null default false,
  created_at datetime(6) not null default current_timestamp(6),
  updated_at datetime(6) not null default current_timestamp(6)
);

create table permissions (
  id char(36) primary key,
  `key` varchar(255) not null unique,
  module varchar(255) not null,
  description text
);

create table role_permissions (
  role_id char(36) not null,
  permission_id char(36) not null,
  primary key (role_id, permission_id),
  foreign key (role_id) references roles (id) on delete cascade,
  foreign key (permission_id) references permissions (id) on delete cascade
);

create table staff_roles (
  staff_id char(36) not null,
  role_id char(36) not null,
  primary key (staff_id, role_id),
  foreign key (staff_id) references staff (id) on delete cascade,
  foreign key (role_id) references roles (id) on delete cascade
);

create table staff_permission_overrides (
  staff_id char(36) not null,
  permission_id char(36) not null,
  effect varchar(16) not null check (effect in ('grant', 'revoke')),
  primary key (staff_id, permission_id),
  foreign key (staff_id) references staff (id) on delete cascade,
  foreign key (permission_id) references permissions (id) on delete cascade
);

-- express-mysql-session's expected schema (its own default table/column names)
create table sessions (
  session_id varchar(128) not null primary key,
  expires int unsigned not null,
  data mediumtext
);

create table audit_log (
  id bigint unsigned primary key auto_increment,
  actor_staff_id char(36),
  action varchar(255) not null,
  entity_type varchar(255) not null,
  entity_id varchar(255) not null,
  before_data json,
  after_data json,
  ip_address varchar(64),
  created_at datetime(6) not null default current_timestamp(6),
  foreign key (actor_staff_id) references staff (id) on delete set null
);
create index audit_log_entity_type_entity_id_idx on audit_log (entity_type, entity_id);

create table settings (
  `key` varchar(255) primary key,
  value json,
  updated_by char(36),
  updated_at datetime(6) not null default current_timestamp(6),
  foreign key (updated_by) references staff (id) on delete set null
);
