-- create-course-tables

create table courses (
  id char(36) primary key,
  name varchar(255) not null,
  code varchar(64) not null unique,
  description text,
  duration_value int not null,
  duration_unit varchar(16) not null check (duration_unit in ('months', 'years')),
  status varchar(16) not null default 'active' check (status in ('active', 'inactive')),
  created_at datetime(6) not null default current_timestamp(6),
  updated_at datetime(6) not null default current_timestamp(6),
  deleted_at datetime(6)
);

create table course_batches (
  id char(36) primary key,
  course_id char(36) not null,
  batch_name varchar(255) not null,
  start_date date not null,
  end_date_planned date not null,
  end_date_actual date,
  status varchar(16) not null default 'upcoming'
    check (status in ('upcoming', 'ongoing', 'completed', 'archived')),
  created_at datetime(6) not null default current_timestamp(6),
  updated_at datetime(6) not null default current_timestamp(6),
  foreign key (course_id) references courses (id) on delete restrict
);
create index course_batches_course_id_idx on course_batches (course_id);
create index course_batches_status_idx on course_batches (status);

create table course_assessment_components (
  id char(36) primary key,
  course_id char(36) not null,
  name varchar(255) not null,
  max_marks numeric(6,2) not null,
  weight_percent numeric(5,2) not null,
  sequence int not null default 0,
  is_active boolean not null default true,
  foreign key (course_id) references courses (id) on delete cascade
);
create index course_assessment_components_course_id_idx on course_assessment_components (course_id);

create table course_pass_criteria (
  course_id char(36) primary key,
  pass_percentage numeric(5,2) not null default 40,
  foreign key (course_id) references courses (id) on delete cascade
);

create table student_enrollments (
  id char(36) primary key,
  student_id char(36) not null,
  course_batch_id char(36) not null,
  enrollment_date date not null,
  status varchar(16) not null default 'active'
    check (status in ('active', 'completed', 'dropped', 'transferred')),
  completion_date date,
  created_at datetime(6) not null default current_timestamp(6),
  updated_at datetime(6) not null default current_timestamp(6),
  foreign key (student_id) references students (id) on delete cascade,
  foreign key (course_batch_id) references course_batches (id) on delete restrict,
  constraint student_enrollments_unique_active unique (student_id, course_batch_id)
);
create index student_enrollments_student_id_idx on student_enrollments (student_id);
create index student_enrollments_course_batch_id_idx on student_enrollments (course_batch_id);
