-- create-staff-attendance-qualifications-remarks

create table staff_attendance_records (
  id char(36) primary key,
  staff_id char(36) not null,
  attendance_date date not null,
  status varchar(16) not null check (status in ('present', 'absent', 'leave')),
  marked_by char(36) not null,
  marked_at datetime(6) not null default current_timestamp(6),
  updated_by char(36),
  updated_at datetime(6) not null default current_timestamp(6),
  foreign key (staff_id) references staff (id) on delete cascade,
  foreign key (marked_by) references staff (id) on delete restrict,
  foreign key (updated_by) references staff (id) on delete set null,
  constraint staff_attendance_records_unique_staff_date unique (staff_id, attendance_date)
) default charset = utf8mb4 collate = utf8mb4_general_ci;
create index staff_attendance_records_attendance_date_idx on staff_attendance_records (attendance_date);

create table student_qualifications (
  id char(36) primary key,
  student_id char(36) not null,
  qualification_name varchar(255) not null,
  institution varchar(255),
  board_or_university varchar(255),
  year_of_passing varchar(16),
  percentage_or_grade varchar(32),
  sequence int not null default 0,
  foreign key (student_id) references students (id) on delete cascade
) default charset = utf8mb4 collate = utf8mb4_general_ci;
create index student_qualifications_student_id_idx on student_qualifications (student_id);

create table student_remarks (
  id char(36) primary key,
  student_id char(36) not null,
  remark text not null,
  created_by char(36) not null,
  created_at datetime(6) not null default current_timestamp(6),
  foreign key (student_id) references students (id) on delete cascade,
  foreign key (created_by) references staff (id) on delete restrict
) default charset = utf8mb4 collate = utf8mb4_general_ci;
create index student_remarks_student_id_idx on student_remarks (student_id);
