-- add-student-profile-fields

alter table students
  add column blood_group varchar(8),
  add column religion varchar(64),
  add column mobile_number varchar(20);

-- Retire 'self' as a contact type (Guardian/Emergency only). Fold any
-- existing 'self' rows into 'guardian' first so tightening the CHECK
-- constraint below can't fail against live data.
update student_contacts set contact_type = 'guardian' where contact_type = 'self';

alter table student_contacts
  drop check student_contacts_chk_1,
  add constraint student_contacts_chk_1 check (contact_type in ('guardian', 'emergency'));
