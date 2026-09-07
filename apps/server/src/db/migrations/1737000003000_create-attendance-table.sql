-- create-attendance-table

create table attendance_records (
  id char(36) primary key,
  enrollment_id char(36) not null,
  attendance_date date not null,
  -- present/absent/half_day only (Late and Excused were dropped later in
  -- the Postgres version of this schema; folded directly in here since this
  -- is a fresh schema with no prior data to migrate)
  status varchar(16) not null check (status in ('present', 'absent', 'half_day')),
  marked_by char(36) not null,
  marked_at datetime(6) not null default current_timestamp(6),
  updated_by char(36),
  updated_at datetime(6) not null default current_timestamp(6),
  foreign key (enrollment_id) references student_enrollments (id) on delete cascade,
  foreign key (marked_by) references staff (id) on delete restrict,
  foreign key (updated_by) references staff (id) on delete set null,
  constraint attendance_records_unique_enrollment_date unique (enrollment_id, attendance_date)
);
create index attendance_records_attendance_date_idx on attendance_records (attendance_date);
