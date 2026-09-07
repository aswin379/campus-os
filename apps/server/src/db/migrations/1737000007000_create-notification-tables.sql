-- create-notification-tables

create table notification_templates (
  id char(36) primary key,
  `key` varchar(255) not null unique,
  channel varchar(16) not null check (channel in ('sms', 'email')),
  subject varchar(255),
  body_template text not null,
  is_active boolean not null default true
);

create table notification_log (
  id bigint unsigned primary key auto_increment,
  recipient_type varchar(64) not null,
  recipient_id char(36) not null,
  channel varchar(16) not null check (channel in ('sms', 'email')),
  template_key varchar(255) not null,
  rendered_body text not null,
  status varchar(16) not null check (status in ('queued', 'sent', 'failed')),
  provider_name varchar(64) not null,
  provider_response json,
  sent_at datetime(6),
  created_at datetime(6) not null default current_timestamp(6)
);
create index notification_log_recipient_type_recipient_id_idx on notification_log (recipient_type, recipient_id);
create index notification_log_template_key_created_at_idx on notification_log (template_key, created_at);

create table notification_settings (
  channel varchar(16) primary key check (channel in ('sms', 'email')),
  provider_name varchar(64) not null,
  config json not null default (json_object())
);
