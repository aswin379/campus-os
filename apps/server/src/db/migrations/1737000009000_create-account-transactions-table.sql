-- create-account-transactions-table

create table account_transactions (
  id char(36) primary key,
  type varchar(16) not null check (type in ('income', 'expense')),
  category varchar(255) not null,
  amount numeric(12,2) not null check (amount > 0),
  transaction_date date not null,
  payment_mode varchar(16) not null check (payment_mode in ('cash', 'cheque', 'online', 'card')),
  description text,
  recorded_by char(36) not null,
  created_at datetime(6) not null default current_timestamp(6),
  updated_at datetime(6) not null default current_timestamp(6),
  deleted_at datetime(6),
  foreign key (recorded_by) references staff (id) on delete restrict
);
create index account_transactions_type_idx on account_transactions (type);
create index account_transactions_transaction_date_idx on account_transactions (transaction_date);
create index account_transactions_category_idx on account_transactions (category);
