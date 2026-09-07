-- create-exam-tables

create table exam_marks (
  id char(36) primary key,
  enrollment_id char(36) not null,
  assessment_component_id char(36) not null,
  marks_obtained numeric(6,2) not null,
  remarks text,
  entered_by char(36) not null,
  entered_at datetime(6) not null default current_timestamp(6),
  foreign key (enrollment_id) references student_enrollments (id) on delete cascade,
  -- restrict, not cascade: prevents replaceAssessmentComponents from
  -- silently wiping historical marks by deleting+re-inserting components
  -- (see git history — the Postgres version of this schema fixed the same
  -- issue in a later migration; folded directly in here since this is a
  -- fresh schema with no prior state to migrate from)
  foreign key (assessment_component_id) references course_assessment_components (id) on delete restrict,
  foreign key (entered_by) references staff (id) on delete restrict,
  constraint exam_marks_unique_enrollment_component unique (enrollment_id, assessment_component_id)
);

create table exam_results (
  id char(36) primary key,
  enrollment_id char(36) not null unique,
  total_percentage numeric(5,2),
  result_status varchar(16) not null default 'incomplete'
    check (result_status in ('pass', 'fail', 'incomplete')),
  computed_at datetime(6) not null default current_timestamp(6),
  published_at datetime(6),
  certificate_number varchar(64) unique,
  certificate_issued_at datetime(6),
  foreign key (enrollment_id) references student_enrollments (id) on delete cascade
);

create table certificate_number_sequences (
  year int primary key,
  last_number int not null default 0
);
