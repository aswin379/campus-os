import { z } from 'zod';
import { isoDateString } from '../../lib/validators.js';

const contactSchema = z.object({
  contactType: z.enum(['guardian', 'emergency']),
  relation: z.string().optional(),
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  isPrimary: z.boolean().optional(),
});

export const createStudentSchema = z.object({
  admissionNumber: z.string().min(1).optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: isoDateString.optional(),
  gender: z.string().optional(),
  bloodGroup: z.string().optional(),
  religion: z.string().optional(),
  mobileNumber: z.string().optional(),
  admissionDate: isoDateString,
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  contacts: z.array(contactSchema).default([]),
});

export const updateStudentSchema = z.object({
  // Not nullable — an admission number is mandatory once assigned, so unlike
  // the other fields below, omitting the key (leave unchanged) is the only
  // way to skip it; a client can never clear it to null.
  admissionNumber: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  // .nullable() lets the client explicitly clear these fields by sending
  // null; omitting the key entirely still means "leave unchanged" — see
  // students/repository.ts's updateStudent for how the two are told apart.
  dateOfBirth: isoDateString.nullable().optional(),
  gender: z.string().nullable().optional(),
  bloodGroup: z.string().nullable().optional(),
  religion: z.string().nullable().optional(),
  mobileNumber: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  pincode: z.string().nullable().optional(),
  status: z.enum(['enquiry', 'active', 'completed', 'dropped', 'suspended']).optional(),
  contacts: z.array(contactSchema).optional(),
});

export const listStudentsQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum(['enquiry', 'active', 'completed', 'dropped', 'suspended']).optional(),
});
