-- create-student-tables

create table admission_number_sequences (
  year int primary key,
  last_number int not null default 0
);

create table students (
  id char(36) primary key,
  admission_number varchar(64) not null unique,
  first_name varchar(255) not null,
  last_name varchar(255) not null,
  date_of_birth date,
  gender varchar(32),
  photo_key text,
  status varchar(32) not null default 'enquiry'
    check (status in ('enquiry', 'active', 'completed', 'dropped', 'suspended')),
  admission_date date not null,
  address text,
  city varchar(255),
  state varchar(255),
  pincode varchar(16),
  created_at datetime(6) not null default current_timestamp(6),
  updated_at datetime(6) not null default current_timestamp(6),
  deleted_at datetime(6)
);
create index students_status_idx on students (status);
create index students_first_name_last_name_idx on students (first_name, last_name);

create table student_contacts (
  id char(36) primary key,
  student_id char(36) not null,
  contact_type varchar(32) not null
    check (contact_type in ('self', 'guardian', 'emergency')),
  relation varchar(64),
  name varchar(255) not null,
  phone varchar(32) not null,
  email varchar(255),
  is_primary boolean not null default false,
  foreign key (student_id) references students (id) on delete cascade
);
create index student_contacts_student_id_idx on student_contacts (student_id);
