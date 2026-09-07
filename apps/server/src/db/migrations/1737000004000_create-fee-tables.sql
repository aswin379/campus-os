-- create-fee-tables

create table fee_structures (
  id char(36) primary key,
  course_id char(36) not null,
  name varchar(255) not null,
  total_amount numeric(10,2) not null,
  effective_from date not null,
  is_active boolean not null default true,
  created_at datetime(6) not null default current_timestamp(6),
  foreign key (course_id) references courses (id) on delete restrict
);
create index fee_structures_course_id_idx on fee_structures (course_id);

create table fee_installments (
  id char(36) primary key,
  fee_structure_id char(36) not null,
  installment_number int not null,
  amount numeric(10,2) not null,
  due_offset_days int not null default 0,
  foreign key (fee_structure_id) references fee_structures (id) on delete cascade
);
create index fee_installments_fee_structure_id_idx on fee_installments (fee_structure_id);

create table fee_additional_charges (
  id char(36) primary key,
  fee_structure_id char(36) not null,
  name varchar(255) not null,
  amount numeric(10,2) not null,
  is_optional boolean not null default false,
  foreign key (fee_structure_id) references fee_structures (id) on delete cascade
);
create index fee_additional_charges_fee_structure_id_idx on fee_additional_charges (fee_structure_id);

create table fee_discounts (
  id char(36) primary key,
  enrollment_id char(36) not null,
  reason varchar(255) not null,
  amount numeric(10,2) not null,
  approved_by char(36) not null,
  approved_at datetime(6) not null default current_timestamp(6),
  foreign key (enrollment_id) references student_enrollments (id) on delete cascade,
  foreign key (approved_by) references staff (id) on delete restrict
);
create index fee_discounts_enrollment_id_idx on fee_discounts (enrollment_id);

create table student_fee_plans (
  id char(36) primary key,
  enrollment_id char(36) not null unique,
  fee_structure_id char(36) not null,
  total_payable numeric(10,2) not null,
  created_at datetime(6) not null default current_timestamp(6),
  foreign key (enrollment_id) references student_enrollments (id) on delete restrict,
  foreign key (fee_structure_id) references fee_structures (id) on delete restrict
);

create table student_fee_installments (
  id char(36) primary key,
  student_fee_plan_id char(36) not null,
  installment_number int not null,
  label varchar(255),
  amount_due numeric(10,2) not null,
  due_date date not null,
  amount_paid numeric(10,2) not null default 0,
  status varchar(16) not null default 'pending'
    check (status in ('pending', 'partial', 'paid', 'overdue')),
  foreign key (student_fee_plan_id) references student_fee_plans (id) on delete cascade
);
create index student_fee_installments_student_fee_plan_id_idx on student_fee_installments (student_fee_plan_id);

create table receipt_number_sequences (
  financial_year varchar(16) primary key,
  last_number int not null default 0,
  prefix varchar(32)
);

create table fee_transactions (
  id char(36) primary key,
  enrollment_id char(36) not null,
  receipt_number varchar(64) not null unique,
  financial_year varchar(16) not null,
  amount numeric(10,2) not null,
  payment_mode varchar(16) not null check (payment_mode in ('cash', 'cheque', 'online', 'card')),
  payment_reference varchar(255),
  payment_date date not null,
  collected_by char(36) not null,
  transaction_type varchar(16) not null check (transaction_type in ('payment', 'adjustment', 'void')),
  reversed_transaction_id char(36),
  notes text,
  created_at datetime(6) not null default current_timestamp(6),
  foreign key (enrollment_id) references student_enrollments (id) on delete restrict,
  foreign key (collected_by) references staff (id) on delete restrict,
  foreign key (reversed_transaction_id) references fee_transactions (id) on delete restrict
);
create index fee_transactions_enrollment_id_idx on fee_transactions (enrollment_id);
create index fee_transactions_financial_year_idx on fee_transactions (financial_year);

create table fee_transaction_installment_allocations (
  id char(36) primary key,
  fee_transaction_id char(36) not null,
  student_fee_installment_id char(36) not null,
  amount_allocated numeric(10,2) not null,
  foreign key (fee_transaction_id) references fee_transactions (id) on delete cascade,
  foreign key (student_fee_installment_id) references student_fee_installments (id) on delete restrict
);
create index fee_transaction_installment_allocations_fee_transaction_id_idx on fee_transaction_installment_allocations (fee_transaction_id);
create index fee_transaction_installment_allocations_student_fee_inst_idx on fee_transaction_installment_allocations (student_fee_installment_id);
