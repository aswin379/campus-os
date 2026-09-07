-- create-leads-tables

create table leads (
  id char(36) primary key,
  full_name varchar(255) not null,
  phone varchar(32) not null,
  email varchar(255),
  source varchar(32) not null
    check (source in ('walk_in', 'phone', 'website', 'referral', 'social_media', 'advertisement', 'other')),
  status varchar(16) not null default 'new'
    check (status in ('new', 'contacted', 'interested', 'converted', 'lost')),
  interested_course_id char(36),
  assigned_to char(36),
  notes text,
  created_by char(36) not null,
  created_at datetime(6) not null default current_timestamp(6),
  updated_at datetime(6) not null default current_timestamp(6),
  deleted_at datetime(6),
  foreign key (interested_course_id) references courses (id) on delete set null,
  foreign key (assigned_to) references staff (id) on delete set null,
  foreign key (created_by) references staff (id) on delete restrict
);
create index leads_status_idx on leads (status);
create index leads_source_idx on leads (source);
create index leads_full_name_idx on leads (full_name);
create index leads_phone_idx on leads (phone);

create table lead_followups (
  id char(36) primary key,
  lead_id char(36) not null,
  followup_date date not null,
  notes text not null,
  next_followup_date date,
  created_by char(36) not null,
  created_at datetime(6) not null default current_timestamp(6),
  foreign key (lead_id) references leads (id) on delete cascade,
  foreign key (created_by) references staff (id) on delete restrict
);
create index lead_followups_lead_id_idx on lead_followups (lead_id);
