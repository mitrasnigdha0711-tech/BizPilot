'use client';

// Auto-generated typed API client — the app's single fetch surface.
// Request bodies are typed against the database schema, so calling an
// endpoint with the wrong field names is a compile error. Do not hand-
// edit — regenerate from the API atlas + schema instead.

import { getToken } from '@/lib/authToken';

// Mock mode: the IDE preview boots before any database exists, so the
// single fetch surface answers locally instead of calling routes that
// would fail on a missing DATABASE_URL. Mirrors the demo session in
// @/lib/authContext so both auth surfaces agree.
// The `process.env.NEXT_PUBLIC_MOCK_MODE` form is deliberate: Next inlines
// that EXACT text at build time. `process.env?.X` or a computed key is not
// matched by the inliner, so it would compile to a lookup that is always
// undefined in the browser bundle — the same way a dynamic
// `process.env['NEXT_PUBLIC_' + name]` once left the preview inspector
// permanently inert. Do not add optional chaining here.
const __NEXEN_IS_MOCK__ =
  (typeof process !== 'undefined' &&
    process.env.NEXT_PUBLIC_MOCK_MODE === 'true') ||
  (typeof process !== 'undefined' && process.env.MOCK_MODE === 'true') ||
  ((globalThis as unknown as { __NEXEN_MOCK__?: boolean }).__NEXEN_MOCK__ === true);

const __NEXEN_DEMO_USER__ = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'demo@example.com',
  name: 'Demo User',
  role: 'freelance_video_editor',
};

const __NEXEN_MOCK_ROWS__: Record<string, any[]> = {
  "users": [
    {
      "id": "00000000-0000-4000-8000-000000000001",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z",
      "email": "demo@example.com",
      "name": "Demo User",
      "role": "freelance_video_editor",
      "businessId": "business_001",
      "isActive": true,
      "failedLoginCount": 3,
      "lockedUntil": "2026-01-15T10:00:00Z",
      "lastLoginAt": "2026-01-15T10:00:00Z",
      "sessionToken": "sample_sessiontoken_1",
      "signedOutAt": "2026-01-15T10:00:00Z",
      "passwordChangedAt": "2026-01-15T10:00:00Z",
      "passwordResetToken": "sample_passwordresettoken_1",
      "passwordResetTokenHash": "sample_passwordresettokenhash_1",
      "passwordResetExpiresAt": "2026-01-15T10:00:00Z",
      "tokenVersion": 3
    },
    {
      "id": "user_002",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z",
      "email": "alex.kim@demo.co",
      "name": "Alex Kim",
      "role": "member",
      "businessId": "business_002",
      "isActive": false,
      "failedLoginCount": 10,
      "lockedUntil": "2026-02-15T10:00:00Z",
      "lastLoginAt": "2026-02-15T10:00:00Z",
      "sessionToken": "sample_sessiontoken_2",
      "signedOutAt": "2026-02-15T10:00:00Z",
      "passwordChangedAt": "2026-02-15T10:00:00Z",
      "passwordResetToken": "sample_passwordresettoken_2",
      "passwordResetTokenHash": "sample_passwordresettokenhash_2",
      "passwordResetExpiresAt": "2026-02-15T10:00:00Z",
      "tokenVersion": 10
    },
    {
      "id": "user_003",
      "createdAt": "2026-03-15T10:00:00Z",
      "updatedAt": "2026-03-15T10:00:00Z",
      "email": "sam.patel@preview.dev",
      "name": "Sam Patel",
      "role": "viewer",
      "businessId": "business_003",
      "isActive": true,
      "failedLoginCount": 17,
      "lockedUntil": "2026-03-15T10:00:00Z",
      "lastLoginAt": "2026-03-15T10:00:00Z",
      "sessionToken": "sample_sessiontoken_3",
      "signedOutAt": "2026-03-15T10:00:00Z",
      "passwordChangedAt": "2026-03-15T10:00:00Z",
      "passwordResetToken": "sample_passwordresettoken_3",
      "passwordResetTokenHash": "sample_passwordresettokenhash_3",
      "passwordResetExpiresAt": "2026-03-15T10:00:00Z",
      "tokenVersion": 17
    }
  ],
  "businesses": [
    {
      "id": "business_001",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z",
      "name": "Pixelhaus Edits",
      "businessType": "FREELANCE",
      "services": [
        "Video editing",
        "Color grading",
        "Motion graphics"
      ],
      "monthlyProjectTarget": 4,
      "workingHoursStart": "09:00",
      "workingHoursEnd": "18:00",
      "currency": "USD",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "business_002",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z",
      "name": "Frame & Fold Studio",
      "businessType": "SMALL_BUSINESS",
      "services": [
        "Brand films",
        "Documentary editing",
        "Social cuts"
      ],
      "monthlyProjectTarget": 6,
      "workingHoursStart": "08:30",
      "workingHoursEnd": "17:30",
      "currency": "USD",
      "userId": "user_002"
    },
    {
      "id": "business_003",
      "createdAt": "2026-03-15T10:00:00Z",
      "updatedAt": "2026-03-15T10:00:00Z",
      "name": "Lena Ortiz Post",
      "businessType": "FREELANCE",
      "services": [
        "Wedding films",
        "Reels editing",
        "Sound mixing"
      ],
      "monthlyProjectTarget": 3,
      "workingHoursStart": "10:00",
      "workingHoursEnd": "17:00",
      "currency": "USD",
      "userId": "user_003"
    },
    {
      "id": "business_004",
      "createdAt": "2026-04-15T10:00:00Z",
      "updatedAt": "2026-04-15T10:00:00Z",
      "name": "Northwind Cut House",
      "businessType": "SMALL_BUSINESS",
      "services": [
        "Corporate video",
        "Subtitling",
        "Sound design"
      ],
      "monthlyProjectTarget": 8,
      "workingHoursStart": "09:00",
      "workingHoursEnd": "18:00",
      "currency": "USD",
      "userId": "00000000-0000-4000-8000-000000000001"
    }
  ],
  "clients": [
    {
      "id": "client_001",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z",
      "name": "Brightlane Films",
      "email": "hello@brightlanefilms.co",
      "phone": "+1 555 0142",
      "address": "210 Mercer St, Austin, TX 78701",
      "status": "ACTIVE",
      "businessId": "business_001",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "client_002",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z",
      "name": "Harbor & Pine Coffee",
      "email": "marketing@harborpine.example",
      "phone": "+1 555 0187",
      "address": "48 Dock Road, Portland, OR 97209",
      "status": "ACTIVE",
      "businessId": "business_002",
      "userId": "user_002"
    },
    {
      "id": "client_003",
      "createdAt": "2026-03-15T10:00:00Z",
      "updatedAt": "2026-03-15T10:00:00Z",
      "name": "Sofia Marrin Photography",
      "email": "sofia@marrinphoto.example",
      "phone": "sample_phone_3",
      "address": "12 Elm Court, Denver, CO 80205",
      "status": "ACTIVE",
      "businessId": "business_003",
      "userId": "user_003"
    },
    {
      "id": "client_004",
      "createdAt": "2026-04-15T10:00:00Z",
      "updatedAt": "2026-04-15T10:00:00Z",
      "name": "Kestrel Health Partners",
      "email": "media@kestrelhealth.example",
      "phone": "+1 555 0129",
      "address": "900 Commerce Ave, Chicago, IL 60607",
      "status": "INACTIVE",
      "businessId": "business_004",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "client_005",
      "createdAt": "2026-05-15T10:00:00Z",
      "updatedAt": "2026-05-15T10:00:00Z",
      "name": "Tom Yeung Ventures",
      "email": "tom@yeungventures.example",
      "phone": "+1 555 0173",
      "address": "sample_address_5",
      "status": "ACTIVE",
      "businessId": "business_001",
      "userId": "user_002"
    },
    {
      "id": "client_006",
      "createdAt": "2026-06-15T10:00:00Z",
      "updatedAt": "2026-06-15T10:00:00Z",
      "name": "Riverside Yoga Collective",
      "email": "studio@riversideyoga.example",
      "phone": "+1 555 0196",
      "address": "77 Willow Lane, Nashville, TN 37203",
      "status": "INACTIVE",
      "businessId": "business_002",
      "userId": "user_003"
    }
  ],
  "projects": [
    {
      "id": "project_001",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z",
      "name": "Brightlane Brand Film",
      "clientId": "client_001",
      "status": "IN_PROGRESS",
      "startDate": "2025-05-05T00:00:00.000Z",
      "deadline": "2025-06-30T00:00:00.000Z",
      "value": 3200,
      "completedAt": "2026-01-15T10:00:00Z",
      "businessId": "business_001",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "project_002",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z",
      "name": "Harbor & Pine Reel Series",
      "clientId": "client_002",
      "status": "COMPLETED",
      "startDate": "2025-04-01T00:00:00.000Z",
      "deadline": "2025-05-15T00:00:00.000Z",
      "value": 1800,
      "completedAt": "2025-05-12T00:00:00.000Z",
      "businessId": "business_002",
      "userId": "user_002"
    },
    {
      "id": "project_003",
      "createdAt": "2026-03-15T10:00:00Z",
      "updatedAt": "2026-03-15T10:00:00Z",
      "name": "Marrin Wedding Highlights",
      "clientId": "client_003",
      "status": "PLANNED",
      "startDate": "2025-07-01T00:00:00.000Z",
      "deadline": "2025-07-25T00:00:00.000Z",
      "value": 2400,
      "completedAt": "2026-03-15T10:00:00Z",
      "businessId": "business_003",
      "userId": "user_003"
    },
    {
      "id": "project_004",
      "createdAt": "2026-04-15T10:00:00Z",
      "updatedAt": "2026-04-15T10:00:00Z",
      "name": "Kestrel Onboarding Videos",
      "clientId": "client_004",
      "status": "CANCELLED",
      "startDate": "2025-03-10T00:00:00.000Z",
      "deadline": "2025-04-30T00:00:00.000Z",
      "value": 4100,
      "completedAt": "2026-04-15T10:00:00Z",
      "businessId": "business_004",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "project_005",
      "createdAt": "2026-05-15T10:00:00Z",
      "updatedAt": "2026-05-15T10:00:00Z",
      "name": "Yeung Investor Update Cut",
      "clientId": "client_005",
      "status": "IN_PROGRESS",
      "startDate": "2025-06-02T00:00:00.000Z",
      "deadline": "2025-06-20T00:00:00.000Z",
      "value": 950,
      "completedAt": "2026-05-15T10:00:00Z",
      "businessId": "business_001",
      "userId": "user_002"
    },
    {
      "id": "project_006",
      "createdAt": "2026-06-15T10:00:00Z",
      "updatedAt": "2026-06-15T10:00:00Z",
      "name": "Riverside Class Teasers",
      "clientId": "client_006",
      "status": "COMPLETED",
      "startDate": "2025-03-01T00:00:00.000Z",
      "deadline": "2025-03-28T00:00:00.000Z",
      "value": 1250,
      "completedAt": "2025-03-26T00:00:00.000Z",
      "businessId": "business_002",
      "userId": "user_003"
    }
  ],
  "invoices": [
    {
      "id": "invoice_001",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z",
      "invoiceNumber": "INV-2025-001",
      "clientId": "client_001",
      "projectId": "project_001",
      "status": "PAID",
      "issueDate": "2025-04-20T00:00:00.000Z",
      "dueDate": "2025-05-05T00:00:00.000Z",
      "amount": 4500,
      "amountPaid": 4500,
      "balanceDue": 0,
      "businessId": "business_001",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "invoice_002",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z",
      "invoiceNumber": "INV-2025-002",
      "clientId": "client_002",
      "projectId": "project_002",
      "status": "PARTIALLY_PAID",
      "issueDate": "2025-05-10T00:00:00.000Z",
      "dueDate": "2025-06-09T00:00:00.000Z",
      "amount": 6200,
      "amountPaid": 3000,
      "balanceDue": 3200,
      "businessId": "business_002",
      "userId": "user_002"
    },
    {
      "id": "invoice_003",
      "createdAt": "2026-03-15T10:00:00Z",
      "updatedAt": "2026-03-15T10:00:00Z",
      "invoiceNumber": "INV-2025-003",
      "clientId": "client_003",
      "projectId": "project_003",
      "status": "OVERDUE",
      "issueDate": "2025-04-02T00:00:00.000Z",
      "dueDate": "2025-04-30T00:00:00.000Z",
      "amount": 2750,
      "amountPaid": 0,
      "balanceDue": 2750,
      "businessId": "business_003",
      "userId": "user_003"
    },
    {
      "id": "invoice_004",
      "createdAt": "2026-04-15T10:00:00Z",
      "updatedAt": "2026-04-15T10:00:00Z",
      "invoiceNumber": "INV-2025-004",
      "clientId": "client_004",
      "projectId": "project_004",
      "status": "SENT",
      "issueDate": "2025-06-01T00:00:00.000Z",
      "dueDate": "2025-06-30T00:00:00.000Z",
      "amount": 1800,
      "amountPaid": 0,
      "balanceDue": 1800,
      "businessId": "business_004",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "invoice_005",
      "createdAt": "2026-05-15T10:00:00Z",
      "updatedAt": "2026-05-15T10:00:00Z",
      "invoiceNumber": "INV-2025-005",
      "clientId": "client_005",
      "projectId": "project_005",
      "status": "DRAFT",
      "issueDate": "2025-06-08T00:00:00.000Z",
      "dueDate": "2025-07-08T00:00:00.000Z",
      "amount": 3400,
      "amountPaid": 0,
      "balanceDue": 3400,
      "businessId": "business_001",
      "userId": "user_002"
    },
    {
      "id": "invoice_006",
      "createdAt": "2026-06-15T10:00:00Z",
      "updatedAt": "2026-06-15T10:00:00Z",
      "invoiceNumber": "INV-2025-006",
      "clientId": "client_006",
      "projectId": "project_006",
      "status": "PAID",
      "issueDate": "2025-03-15T00:00:00.000Z",
      "dueDate": "2025-03-30T00:00:00.000Z",
      "amount": 950,
      "amountPaid": 950,
      "balanceDue": 0,
      "businessId": "business_002",
      "userId": "user_003"
    }
  ],
  "invoice_line_items": [
    {
      "id": "invoice_line_item_001",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z",
      "invoiceId": "invoice_001",
      "description": "Brand film edit, 90 sec cut",
      "quantity": 1,
      "unitPrice": 3200,
      "amount": 3200
    },
    {
      "id": "invoice_line_item_002",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z",
      "invoiceId": "invoice_002",
      "description": "Color grading session",
      "quantity": 4,
      "unitPrice": 150,
      "amount": 600
    },
    {
      "id": "invoice_line_item_003",
      "createdAt": "2026-03-15T10:00:00Z",
      "updatedAt": "2026-03-15T10:00:00Z",
      "invoiceId": "invoice_003",
      "description": "Reel series edits (6 reels)",
      "quantity": 6,
      "unitPrice": 300,
      "amount": 1800
    },
    {
      "id": "invoice_line_item_004",
      "createdAt": "2026-04-15T10:00:00Z",
      "updatedAt": "2026-04-15T10:00:00Z",
      "invoiceId": "invoice_004",
      "description": "Motion title graphics",
      "quantity": 1,
      "unitPrice": 450,
      "amount": 450
    },
    {
      "id": "invoice_line_item_005",
      "createdAt": "2026-05-15T10:00:00Z",
      "updatedAt": "2026-05-15T10:00:00Z",
      "invoiceId": "invoice_005",
      "description": "Investor update rough cut",
      "quantity": 1,
      "unitPrice": 950,
      "amount": 950
    },
    {
      "id": "invoice_line_item_006",
      "createdAt": "2026-06-15T10:00:00Z",
      "updatedAt": "2026-06-15T10:00:00Z",
      "invoiceId": "invoice_006",
      "description": "Sound mix and cleanup",
      "quantity": 2,
      "unitPrice": 275,
      "amount": 550
    }
  ],
  "payments": [
    {
      "id": "payment_001",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z",
      "invoiceId": "invoice_001",
      "clientId": "client_001",
      "amount": 4500,
      "status": "RECEIVED",
      "expectedDate": "2025-05-04T00:00:00.000Z",
      "receivedAt": "2025-05-03T00:00:00.000Z",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "payment_002",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z",
      "invoiceId": "invoice_002",
      "clientId": "client_002",
      "amount": 3000,
      "status": "RECEIVED",
      "expectedDate": "2025-05-28T00:00:00.000Z",
      "receivedAt": "2025-05-27T00:00:00.000Z",
      "userId": "user_002"
    },
    {
      "id": "payment_003",
      "createdAt": "2026-03-15T10:00:00Z",
      "updatedAt": "2026-03-15T10:00:00Z",
      "invoiceId": "invoice_003",
      "clientId": "client_003",
      "amount": 3200,
      "status": "EXPECTED",
      "expectedDate": "2025-06-25T00:00:00.000Z",
      "receivedAt": "2026-03-15T10:00:00Z",
      "userId": "user_003"
    },
    {
      "id": "payment_004",
      "createdAt": "2026-04-15T10:00:00Z",
      "updatedAt": "2026-04-15T10:00:00Z",
      "invoiceId": "invoice_004",
      "clientId": "client_004",
      "amount": 1800,
      "status": "EXPECTED",
      "expectedDate": "2025-07-02T00:00:00.000Z",
      "receivedAt": "2026-04-15T10:00:00Z",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "payment_005",
      "createdAt": "2026-05-15T10:00:00Z",
      "updatedAt": "2026-05-15T10:00:00Z",
      "invoiceId": "invoice_005",
      "clientId": "client_005",
      "amount": 950,
      "status": "RECEIVED",
      "expectedDate": "2025-03-29T00:00:00.000Z",
      "receivedAt": "2025-03-31T00:00:00.000Z",
      "userId": "user_002"
    },
    {
      "id": "payment_006",
      "createdAt": "2026-06-15T10:00:00Z",
      "updatedAt": "2026-06-15T10:00:00Z",
      "invoiceId": "invoice_006",
      "clientId": "client_006",
      "amount": 2750,
      "status": "EXPECTED",
      "expectedDate": "2025-06-18T00:00:00.000Z",
      "receivedAt": "2026-06-15T10:00:00Z",
      "userId": "user_003"
    }
  ],
  "reminders": [
    {
      "id": "reminder_001",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z",
      "invoiceId": "invoice_001",
      "clientId": "client_001",
      "subject": "Quick nudge on invoice INV-2025-002",
      "body": "Hi Brightlane team, just a friendly reminder that the remaining balance of $3,200 is due June 9. Let me know if you need anything.",
      "tone": "FRIENDLY",
      "status": "SENT",
      "isUserEdited": false,
      "editedAt": "2026-01-15T10:00:00Z",
      "approvedAt": "2025-06-05T00:00:00.000Z",
      "sentAt": "2025-06-05T00:00:00.000Z",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "reminder_002",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z",
      "invoiceId": "invoice_002",
      "clientId": "client_002",
      "subject": "Invoice INV-2025-003 is overdue",
      "body": "Hi Tom, invoice INV-2025-003 for $2,750 was due April 30 and is still open. Could you confirm a payment date this week?",
      "tone": "FIRM",
      "status": "APPROVED",
      "isUserEdited": true,
      "editedAt": "2025-06-09T00:00:00.000Z",
      "approvedAt": "2025-06-09T00:00:00.000Z",
      "sentAt": "2026-02-15T10:00:00Z",
      "userId": "user_002"
    },
    {
      "id": "reminder_003",
      "createdAt": "2026-03-15T10:00:00Z",
      "updatedAt": "2026-03-15T10:00:00Z",
      "invoiceId": "invoice_003",
      "clientId": "client_003",
      "subject": "Final notice: INV-2025-003",
      "body": "Hello, this is the final reminder for invoice INV-2025-003. Please arrange payment within 7 days to avoid pausing new work.",
      "tone": "FINAL",
      "status": "DRAFT",
      "isUserEdited": false,
      "editedAt": "2026-03-15T10:00:00Z",
      "approvedAt": "2026-03-15T10:00:00Z",
      "sentAt": "2026-03-15T10:00:00Z",
      "userId": "user_003"
    },
    {
      "id": "reminder_004",
      "createdAt": "2026-04-15T10:00:00Z",
      "updatedAt": "2026-04-15T10:00:00Z",
      "invoiceId": "invoice_004",
      "clientId": "client_004",
      "subject": "Checking in on INV-2025-004",
      "body": "Hi Harbor & Pine team, hope the reel series is working for you. Invoice INV-2025-004 is due June 30 when convenient.",
      "tone": "FRIENDLY",
      "status": "DRAFT",
      "isUserEdited": false,
      "editedAt": "2026-04-15T10:00:00Z",
      "approvedAt": "2026-04-15T10:00:00Z",
      "sentAt": "2026-04-15T10:00:00Z",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "reminder_005",
      "createdAt": "2026-05-15T10:00:00Z",
      "updatedAt": "2026-05-15T10:00:00Z",
      "invoiceId": "invoice_005",
      "clientId": "client_005",
      "subject": "Payment reminder for Marrin Studio",
      "body": "Hi Sofia, a quick note that the deposit for the July wedding highlights is due before we lock the edit schedule.",
      "tone": "FRIENDLY",
      "status": "SENT",
      "isUserEdited": true,
      "editedAt": "2025-05-30T00:00:00.000Z",
      "approvedAt": "2025-05-30T00:00:00.000Z",
      "sentAt": "2025-05-31T00:00:00.000Z",
      "userId": "user_002"
    }
  ],
  "expen": [
    {
      "id": "expen_001",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z",
      "description": "Adobe Creative Cloud subscription",
      "amount": 84.99,
      "category": "Software",
      "expenseDate": "2025-06-01T00:00:00.000Z",
      "projectId": "project_001",
      "businessId": "business_001",
      "userId": "user_001"
    },
    {
      "id": "expen_002",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z",
      "description": "External SSD, 2TB",
      "amount": 129.0,
      "category": "Equipment",
      "expenseDate": "2025-05-18T00:00:00.000Z",
      "projectId": "project_002",
      "businessId": "business_002",
      "userId": "user_002"
    },
    {
      "id": "expen_003",
      "createdAt": "2026-03-15T10:00:00Z",
      "updatedAt": "2026-03-15T10:00:00Z",
      "description": "Coworking day pass",
      "amount": 25.0,
      "category": "Workspace",
      "expenseDate": "2025-05-22T00:00:00.000Z",
      "projectId": "project_003",
      "businessId": "business_003",
      "userId": "user_003"
    },
    {
      "id": "expen_004",
      "createdAt": "2026-04-15T10:00:00Z",
      "updatedAt": "2026-04-15T10:00:00Z",
      "description": "Stock footage license",
      "amount": 149.0,
      "category": "Assets",
      "expenseDate": "2025-06-04T00:00:00.000Z",
      "projectId": "project_004",
      "businessId": "business_004",
      "userId": "user_004"
    },
    {
      "id": "expen_005",
      "createdAt": "2026-05-15T10:00:00Z",
      "updatedAt": "2026-05-15T10:00:00Z",
      "description": "Client lunch, Harbor & Pine kickoff",
      "amount": 62.4,
      "category": "Meals",
      "expenseDate": "2025-04-09T00:00:00.000Z",
      "projectId": "project_005",
      "businessId": "business_005",
      "userId": "user_005"
    },
    {
      "id": "expen_006",
      "createdAt": "2026-06-15T10:00:00Z",
      "updatedAt": "2026-06-15T10:00:00Z",
      "description": "Fast Gmail and Drive storage plan",
      "amount": 9.99,
      "category": "Software",
      "expenseDate": "2025-06-02T00:00:00.000Z",
      "projectId": "project_006",
      "businessId": "business_006",
      "userId": "user_006"
    }
  ],
  "recurring_bills": [
    {
      "id": "recurring_bill_001",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z",
      "name": "Adobe Creative Cloud",
      "amount": 84.99,
      "frequency": "MONTHLY",
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2026-01-15T10:00:00Z",
      "nextDueDate": "2025-07-01T00:00:00.000Z",
      "lastPaidAt": "2025-06-01T00:00:00.000Z",
      "status": "ACTIVE",
      "businessId": "business_001",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "recurring_bill_002",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z",
      "name": "Coworking membership",
      "amount": 220.0,
      "frequency": "MONTHLY",
      "startDate": "2024-09-01T00:00:00.000Z",
      "endDate": "2026-02-15T10:00:00Z",
      "nextDueDate": "2025-07-01T00:00:00.000Z",
      "lastPaidAt": "2025-06-01T00:00:00.000Z",
      "status": "ACTIVE",
      "businessId": "business_002",
      "userId": "user_002"
    },
    {
      "id": "recurring_bill_003",
      "createdAt": "2026-03-15T10:00:00Z",
      "updatedAt": "2026-03-15T10:00:00Z",
      "name": "Portfolio website hosting",
      "amount": 180.0,
      "frequency": "YEARLY",
      "startDate": "2023-03-10T00:00:00.000Z",
      "endDate": "2026-03-15T10:00:00Z",
      "nextDueDate": "2026-03-10T00:00:00.000Z",
      "lastPaidAt": "2025-03-10T00:00:00.000Z",
      "status": "ACTIVE",
      "businessId": "business_003",
      "userId": "user_003"
    },
    {
      "id": "recurring_bill_004",
      "createdAt": "2026-04-15T10:00:00Z",
      "updatedAt": "2026-04-15T10:00:00Z",
      "name": "Frame.io review seat",
      "amount": 30.0,
      "frequency": "MONTHLY",
      "startDate": "2024-05-01T00:00:00.000Z",
      "endDate": "2025-05-31T00:00:00.000Z",
      "nextDueDate": "2025-06-01T00:00:00.000Z",
      "lastPaidAt": "2025-05-01T00:00:00.000Z",
      "status": "ENDED",
      "businessId": "business_004",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "recurring_bill_005",
      "createdAt": "2026-05-15T10:00:00Z",
      "updatedAt": "2026-05-15T10:00:00Z",
      "name": "Music library subscription",
      "amount": 45.0,
      "frequency": "QUARTERLY",
      "startDate": "2024-07-01T00:00:00.000Z",
      "endDate": "2026-05-15T10:00:00Z",
      "nextDueDate": "2025-09-01T00:00:00.000Z",
      "lastPaidAt": "2025-06-01T00:00:00.000Z",
      "status": "PAUSED",
      "businessId": "business_001",
      "userId": "user_002"
    }
  ],
  "goals": [
    {
      "id": "goal_001",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z",
      "title": "Close 4 projects in Q2",
      "periodStart": "2025-04-01T00:00:00.000Z",
      "periodEnd": "2025-06-30T00:00:00.000Z",
      "targetProjectCount": 4,
      "completedCount": 2,
      "status": "ACTIVE",
      "businessId": "business_001",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "goal_002",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z",
      "title": "Six projects in Q1",
      "periodStart": "2025-01-01T00:00:00.000Z",
      "periodEnd": "2025-03-31T00:00:00.000Z",
      "targetProjectCount": 6,
      "completedCount": 6,
      "status": "ACHIEVED",
      "businessId": "business_002",
      "userId": "user_002"
    },
    {
      "id": "goal_003",
      "createdAt": "2026-03-15T10:00:00Z",
      "updatedAt": "2026-03-15T10:00:00Z",
      "title": "Monthly target for April",
      "periodStart": "2025-04-01T00:00:00.000Z",
      "periodEnd": "2025-04-30T00:00:00.000Z",
      "targetProjectCount": 3,
      "completedCount": 1,
      "status": "MISSED",
      "businessId": "business_003",
      "userId": "user_003"
    },
    {
      "id": "goal_004",
      "createdAt": "2026-04-15T10:00:00Z",
      "updatedAt": "2026-04-15T10:00:00Z",
      "title": "Land two wedding clients",
      "periodStart": "2025-07-01T00:00:00.000Z",
      "periodEnd": "2025-09-30T00:00:00.000Z",
      "targetProjectCount": 2,
      "completedCount": 0,
      "status": "ACTIVE",
      "businessId": "business_004",
      "userId": "00000000-0000-4000-8000-000000000001"
    }
  ],
  "tasks": [
    {
      "id": "task_001",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z",
      "title": "Send color grade to Brightlane",
      "type": "TASK",
      "status": "OPEN",
      "priority": "HIGH",
      "priorityNote": "Blocks their final approval",
      "dueDate": "2025-06-12T00:00:00.000Z",
      "plannedWeekStart": "2025-06-09T00:00:00.000Z",
      "completedAt": "2026-01-15T10:00:00Z",
      "projectId": "project_001",
      "clientId": "client_001",
      "goalId": "goal_001",
      "quoteId": "quote_001",
      "assigneeId": "00000000-0000-4000-8000-000000000001",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "task_002",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z",
      "title": "Follow up on overdue INV-2025-003",
      "type": "FOLLOW_UP",
      "status": "OPEN",
      "priority": "HIGH",
      "priorityNote": "Cashflow depends on this payment",
      "dueDate": "2025-06-10T00:00:00.000Z",
      "plannedWeekStart": "2025-06-09T00:00:00.000Z",
      "completedAt": "2026-02-15T10:00:00Z",
      "projectId": "project_002",
      "clientId": "client_002",
      "goalId": "goal_002",
      "quoteId": "quote_002",
      "assigneeId": "user_002",
      "userId": "user_002"
    },
    {
      "id": "task_003",
      "createdAt": "2026-03-15T10:00:00Z",
      "updatedAt": "2026-03-15T10:00:00Z",
      "title": "Export social cutdowns for Harbor & Pine",
      "type": "TASK",
      "status": "COMPLETED",
      "priority": "MEDIUM",
      "priorityNote": "sample_prioritynote_3",
      "dueDate": "2025-05-14T00:00:00.000Z",
      "plannedWeekStart": "2025-05-12T00:00:00.000Z",
      "completedAt": "2025-05-13T00:00:00.000Z",
      "projectId": "project_003",
      "clientId": "client_003",
      "goalId": "goal_003",
      "quoteId": "quote_003",
      "assigneeId": "user_003",
      "userId": "user_003"
    },
    {
      "id": "task_004",
      "createdAt": "2026-04-15T10:00:00Z",
      "updatedAt": "2026-04-15T10:00:00Z",
      "title": "Check in on Kestrel renewal",
      "type": "FOLLOW_UP",
      "status": "OPEN",
      "priority": "LOW",
      "priorityNote": "sample_prioritynote_4",
      "dueDate": "2025-06-30T00:00:00.000Z",
      "plannedWeekStart": "2026-04-15T10:00:00Z",
      "completedAt": "2026-04-15T10:00:00Z",
      "projectId": "project_004",
      "clientId": "client_004",
      "goalId": "goal_004",
      "quoteId": "quote_004",
      "assigneeId": "00000000-0000-4000-8000-000000000001",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "task_005",
      "createdAt": "2026-05-15T10:00:00Z",
      "updatedAt": "2026-05-15T10:00:00Z",
      "title": "Book Marrin wedding shoot crew",
      "type": "TASK",
      "status": "OPEN",
      "priority": "MEDIUM",
      "priorityNote": "Needed before July 1",
      "dueDate": "2025-06-25T00:00:00.000Z",
      "plannedWeekStart": "2025-06-16T00:00:00.000Z",
      "completedAt": "2026-05-15T10:00:00Z",
      "projectId": "project_005",
      "clientId": "client_005",
      "goalId": "goal_001",
      "quoteId": "quote_005",
      "assigneeId": "user_002",
      "userId": "user_002"
    },
    {
      "id": "task_006",
      "createdAt": "2026-06-15T10:00:00Z",
      "updatedAt": "2026-06-15T10:00:00Z",
      "title": "Renew SSD warranty paperwork",
      "type": "TASK",
      "status": "COMPLETED",
      "priority": "LOW",
      "priorityNote": "sample_prioritynote_6",
      "dueDate": "2025-05-20T00:00:00.000Z",
      "plannedWeekStart": "2026-06-15T10:00:00Z",
      "completedAt": "2025-05-19T00:00:00.000Z",
      "projectId": "project_006",
      "clientId": "client_006",
      "goalId": "goal_002",
      "quoteId": "quote_006",
      "assigneeId": "user_003",
      "userId": "user_003"
    }
  ],
  "insights": [
    {
      "id": "insight_001",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z",
      "type": "ALERT",
      "title": "Invoice INV-2025-003 is 40 days overdue",
      "body": "$2,750 from Tom Yeung Ventures has not been paid. This is your largest overdue balance.",
      "recommendedAction": "Send the firm reminder today",
      "priority": "HIGH",
      "status": "OPEN",
      "source": "SYSTEM",
      "isAlert": true,
      "isStale": false,
      "dueDate": "2025-06-10T00:00:00.000Z",
      "periodStart": "2026-01-15T10:00:00Z",
      "periodEnd": "2026-01-15T10:00:00Z",
      "generatedAt": "2025-06-08T09:00:00.000Z",
      "expiresAt": "2025-06-15T00:00:00.000Z",
      "dismissedAt": "2026-01-15T10:00:00Z",
      "invoiceId": "invoice_001",
      "projectId": "project_001",
      "businessId": "business_001",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "insight_002",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z",
      "type": "GROWTH_INSIGHT",
      "title": "Wedding work pays above average",
      "body": "Your wedding highlight projects average $2,400, about 40% above your typical reel project. Consider more wedding outreach.",
      "recommendedAction": "Reach out to two past wedding leads",
      "priority": "MEDIUM",
      "status": "OPEN",
      "source": "AI",
      "isAlert": false,
      "isStale": false,
      "dueDate": "2026-02-15T10:00:00Z",
      "periodStart": "2025-04-01T00:00:00.000Z",
      "periodEnd": "2025-06-30T00:00:00.000Z",
      "generatedAt": "2025-06-06T10:15:00.000Z",
      "expiresAt": "2025-07-06T00:00:00.000Z",
      "dismissedAt": "2026-02-15T10:00:00Z",
      "invoiceId": "invoice_002",
      "projectId": "project_002",
      "businessId": "business_002",
      "userId": "user_002"
    },
    {
      "id": "insight_003",
      "createdAt": "2026-03-15T10:00:00Z",
      "updatedAt": "2026-03-15T10:00:00Z",
      "type": "BUSINESS_ADVICE",
      "title": "Raise deposits on new projects",
      "body": "Clients who paid a 50% deposit upfront paid on time 90% of the time. Consider requiring one on projects over $2,000.",
      "recommendedAction": "Update your contract template",
      "priority": "MEDIUM",
      "status": "DONE",
      "source": "AI",
      "isAlert": false,
      "isStale": false,
      "dueDate": "2026-03-15T10:00:00Z",
      "periodStart": "2026-03-15T10:00:00Z",
      "periodEnd": "2026-03-15T10:00:00Z",
      "generatedAt": "2025-05-20T08:30:00.000Z",
      "expiresAt": "2026-03-15T10:00:00Z",
      "dismissedAt": "2026-03-15T10:00:00Z",
      "invoiceId": "invoice_003",
      "projectId": "project_003",
      "businessId": "business_003",
      "userId": "user_003"
    },
    {
      "id": "insight_004",
      "createdAt": "2026-04-15T10:00:00Z",
      "updatedAt": "2026-04-15T10:00:00Z",
      "type": "NEXT_ACTION",
      "title": "Plan next week around deadlines",
      "body": "Brightlane color grade is due soon and two invoices need follow-up. Block mornings for client work.",
      "recommendedAction": "Review this week's plan",
      "priority": "HIGH",
      "status": "OPEN",
      "source": "AI",
      "isAlert": false,
      "isStale": false,
      "dueDate": "2025-06-09T00:00:00.000Z",
      "periodStart": "2025-06-09T00:00:00.000Z",
      "periodEnd": "2025-06-15T00:00:00.000Z",
      "generatedAt": "2025-06-08T07:45:00.000Z",
      "expiresAt": "2025-06-09T00:00:00.000Z",
      "dismissedAt": "2026-04-15T10:00:00Z",
      "invoiceId": "invoice_004",
      "projectId": "project_004",
      "businessId": "business_004",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "insight_005",
      "createdAt": "2026-05-15T10:00:00Z",
      "updatedAt": "2026-05-15T10:00:00Z",
      "type": "ALERT",
      "title": "Expense spike in May",
      "body": "Software and equipment costs rose 35% above your monthly average.",
      "recommendedAction": "sample_recommendedaction_5",
      "priority": "LOW",
      "status": "DISMISSED",
      "source": "SYSTEM",
      "isAlert": true,
      "isStale": true,
      "dueDate": "2026-05-15T10:00:00Z",
      "periodStart": "2025-05-01T00:00:00.000Z",
      "periodEnd": "2025-05-31T00:00:00.000Z",
      "generatedAt": "2025-06-01T06:00:00.000Z",
      "expiresAt": "2025-06-05T00:00:00.000Z",
      "dismissedAt": "2025-06-02T12:20:00.000Z",
      "invoiceId": "invoice_005",
      "projectId": "project_005",
      "businessId": "business_001",
      "userId": "user_002"
    },
    {
      "id": "insight_006",
      "createdAt": "2026-06-15T10:00:00Z",
      "updatedAt": "2026-06-15T10:00:00Z",
      "type": "GROWTH_INSIGHT",
      "title": "Monthly target at risk",
      "body": "You have closed 2 of 4 Q2 projects with 3 weeks left. Current pace suggests 3 total.",
      "recommendedAction": "Pitch one new project this week",
      "priority": "HIGH",
      "status": "OPEN",
      "source": "AI",
      "isAlert": true,
      "isStale": false,
      "dueDate": "2025-06-30T00:00:00.000Z",
      "periodStart": "2025-04-01T00:00:00.000Z",
      "periodEnd": "2025-06-30T00:00:00.000Z",
      "generatedAt": "2025-06-07T16:00:00.000Z",
      "expiresAt": "2025-06-30T00:00:00.000Z",
      "dismissedAt": "2026-06-15T10:00:00Z",
      "invoiceId": "invoice_006",
      "projectId": "project_006",
      "businessId": "business_002",
      "userId": "user_003"
    }
  ],
  "cashflow_forecasts": [
    {
      "id": "cashflow_forecast_001",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z",
      "horizonDays": 30,
      "projectedInflow": 6000,
      "projectedOutflow": 2100,
      "netCashflow": 3900,
      "baselineBalance": 8400,
      "projectedBalance": 12300,
      "shortfallAmount": 0,
      "generatedAt": "2025-06-08T09:00:00.000Z",
      "businessId": "business_001",
      "userId": "00000000-0000-4000-8000-000000000001"
    },
    {
      "id": "cashflow_forecast_002",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z",
      "horizonDays": 60,
      "projectedInflow": 9800,
      "projectedOutflow": 4300,
      "netCashflow": 5500,
      "baselineBalance": 8400,
      "projectedBalance": 13900,
      "shortfallAmount": 0,
      "generatedAt": "2025-06-08T09:00:00.000Z",
      "businessId": "business_002",
      "userId": "user_002"
    },
    {
      "id": "cashflow_forecast_003",
      "createdAt": "2026-03-15T10:00:00Z",
      "updatedAt": "2026-03-15T10:00:00Z",
      "horizonDays": 90,
      "projectedInflow": 11200,
      "projectedOutflow": 6900,
      "netCashflow": 4300,
      "baselineBalance": 8400,
      "projectedBalance": 12700,
      "shortfallAmount": 0,
      "generatedAt": "2025-06-08T09:00:00.000Z",
      "businessId": "business_003",
      "userId": "user_003"
    },
    {
      "id": "cashflow_forecast_004",
      "createdAt": "2026-04-15T10:00:00Z",
      "updatedAt": "2026-04-15T10:00:00Z",
      "horizonDays": 30,
      "projectedInflow": 2400,
      "projectedOutflow": 2650,
      "netCashflow": -250,
      "baselineBalance": 1900,
      "projectedBalance": 1650,
      "shortfallAmount": 1000,
      "generatedAt": "2025-05-15T09:00:00.000Z",
      "businessId": "business_004",
      "userId": "00000000-0000-4000-8000-000000000001"
    }
  ],
  "simulations": [
    {
      "id": "simulation_001",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z",
      "name": "Brightlane pays 14 days late",
      "scenarioType": "DELAYED_PAYMENT",
      "delayDays": 14,
      "invoiceId": "invoice_001",
      "projectedPaymentDate": "2025-07-09T00:00:00.000Z",
      "status": "COMPLETED",
      "businessId": "business_001",
      "userId": "00000000-0000-4000-8000-000000000001",
      "projectedBalance": 9100,
      "shortfallAmount": 0
    },
    {
      "id": "simulation_002",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z",
      "name": "Tom Yeung pays 30 days late",
      "scenarioType": "DELAYED_PAYMENT",
      "delayDays": 30,
      "invoiceId": "invoice_002",
      "projectedPaymentDate": "2025-07-30T00:00:00.000Z",
      "status": "COMPLETED",
      "businessId": "business_002",
      "userId": "user_002",
      "projectedBalance": 7400,
      "shortfallAmount": 0
    },
    {
      "id": "simulation_003",
      "createdAt": "2026-03-15T10:00:00Z",
      "updatedAt": "2026-03-15T10:00:00Z",
      "name": "Skip one wedding booking",
      "scenarioType": "CUSTOM",
      "delayDays": 17,
      "invoiceId": "invoice_003",
      "projectedPaymentDate": "2026-03-15T10:00:00Z",
      "status": "DRAFT",
      "businessId": "business_003",
      "userId": "user_003",
      "projectedBalance": 10200,
      "shortfallAmount": 0
    },
    {
      "id": "simulation_004",
      "createdAt": "2026-04-15T10:00:00Z",
      "updatedAt": "2026-04-15T10:00:00Z",
      "name": "Two clients pay 45 days late",
      "scenarioType": "DELAYED_PAYMENT",
      "delayDays": 45,
      "invoiceId": "invoice_004",
      "projectedPaymentDate": "2025-08-14T00:00:00.000Z",
      "status": "DRAFT",
      "businessId": "business_004",
      "userId": "00000000-0000-4000-8000-000000000001",
      "projectedBalance": 3800,
      "shortfallAmount": 1200
    }
  ],
  "health_scores": [
    {
      "id": "health_score_001",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z",
      "overallScore": 78,
      "projectConsistencyScore": 82,
      "paymentCollectionScore": 65,
      "cashflowStabilityScore": 80,
      "workloadScore": 85,
      "expenseManagementScore": 74,
      "generatedAt": "2025-06-08T09:00:00.000Z",
      "businessId": "business_001",
      "userId": "00000000-0000-4000-8000-000000000001",
      "dragFactors": [
        "Overdue invoice INV-2025-003",
        "Missed April target"
      ]
    },
    {
      "id": "health_score_002",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z",
      "overallScore": 71,
      "projectConsistencyScore": 68,
      "paymentCollectionScore": 70,
      "cashflowStabilityScore": 72,
      "workloadScore": 74,
      "expenseManagementScore": 69,
      "generatedAt": "2025-05-31T09:00:00.000Z",
      "businessId": "business_002",
      "userId": "user_002",
      "dragFactors": [
        "Two projects behind schedule"
      ]
    },
    {
      "id": "health_score_003",
      "createdAt": "2026-03-15T10:00:00Z",
      "updatedAt": "2026-03-15T10:00:00Z",
      "overallScore": 84,
      "projectConsistencyScore": 88,
      "paymentCollectionScore": 85,
      "cashflowStabilityScore": 81,
      "workloadScore": 80,
      "expenseManagementScore": 86,
      "generatedAt": "2025-03-31T09:00:00.000Z",
      "businessId": "business_003",
      "userId": "user_003",
      "dragFactors": {}
    },
    {
      "id": "health_score_004",
      "createdAt": "2026-04-15T10:00:00Z",
      "updatedAt": "2026-04-15T10:00:00Z",
      "overallScore": 58,
      "projectConsistencyScore": 52,
      "paymentCollectionScore": 55,
      "cashflowStabilityScore": 60,
      "workloadScore": 66,
      "expenseManagementScore": 48,
      "generatedAt": "2025-02-28T09:00:00.000Z",
      "businessId": "business_004",
      "userId": "00000000-0000-4000-8000-000000000001",
      "dragFactors": [
        "Irregular project pipeline",
        "Unlogged expenses"
      ]
    }
  ],
  "quotes": [
    {
      "id": "quote_001",
      "createdAt": "2026-01-15T10:00:00Z",
      "updatedAt": "2026-01-15T10:00:00Z",
      "text": "Cut for the feeling first, then tighten for the story.",
      "author": "Walter Murch",
      "personalSuggestion": "Start Brightlane's cut by rough-timing the emotional beats.",
      "displayDate": "2025-06-08T00:00:00.000Z",
      "isFavourite": true,
      "businessId": "business_001",
      "userId": "00000000-0000-4000-8000-000000000001",
      "challengeText": "Finish one rough cut without stopping to polish.",
      "challengeStatus": "ACCEPTED"
    },
    {
      "id": "quote_002",
      "createdAt": "2026-02-15T10:00:00Z",
      "updatedAt": "2026-02-15T10:00:00Z",
      "text": "Every frame is a decision you can make on purpose.",
      "author": "sample_author_2",
      "personalSuggestion": "sample_personalsuggestion_2",
      "displayDate": "2025-06-07T00:00:00.000Z",
      "isFavourite": false,
      "businessId": "business_002",
      "userId": "user_002",
      "challengeText": "sample_challengetext_2",
      "challengeStatus": "sample_challengestatus_2"
    },
    {
      "id": "quote_003",
      "createdAt": "2026-03-15T10:00:00Z",
      "updatedAt": "2026-03-15T10:00:00Z",
      "text": "Pricing is part of the craft, not an apology for it.",
      "author": "Unknown",
      "personalSuggestion": "Raise your deposit ask on the next wedding inquiry.",
      "displayDate": "2025-06-06T00:00:00.000Z",
      "isFavourite": true,
      "businessId": "business_003",
      "userId": "user_003",
      "challengeText": "Send one proposal with a 50% deposit.",
      "challengeStatus": "COMPLETED"
    },
    {
      "id": "quote_004",
      "createdAt": "2026-04-15T10:00:00Z",
      "updatedAt": "2026-04-15T10:00:00Z",
      "text": "Done beats perfect when the client is waiting.",
      "author": "Ira Glass",
      "personalSuggestion": "Ship the Harbor & Pine reel cutdowns today.",
      "displayDate": "2025-06-05T00:00:00.000Z",
      "isFavourite": false,
      "businessId": "business_004",
      "userId": "00000000-0000-4000-8000-000000000001",
      "challengeText": "Deliver one draft before noon.",
      "challengeStatus": "SKIPPED"
    },
    {
      "id": "quote_005",
      "createdAt": "2026-05-15T10:00:00Z",
      "updatedAt": "2026-05-15T10:00:00Z",
      "text": "Your calendar is your strongest creative tool.",
      "author": "sample_author_5",
      "personalSuggestion": "Block two focus mornings this week.",
      "displayDate": "2025-06-04T00:00:00.000Z",
      "isFavourite": false,
      "businessId": "business_001",
      "userId": "user_002",
      "challengeText": "sample_challengetext_5",
      "challengeStatus": "sample_challengestatus_5"
    },
    {
      "id": "quote_006",
      "createdAt": "2026-06-15T10:00:00Z",
      "updatedAt": "2026-06-15T10:00:00Z",
      "text": "Make it easy for the client to say yes.",
      "author": "Pixelhaus Editing Notes",
      "personalSuggestion": "sample_personalsuggestion_6",
      "displayDate": "2025-06-03T00:00:00.000Z",
      "isFavourite": false,
      "businessId": "business_002",
      "userId": "user_003",
      "challengeText": "Send a clear payment link with each invoice.",
      "challengeStatus": "ACCEPTED"
    }
  ]
};
__NEXEN_MOCK_ROWS__["invoice-line-items"] = __NEXEN_MOCK_ROWS__["invoice_line_items"];
__NEXEN_MOCK_ROWS__["invoiceLineItems"] = __NEXEN_MOCK_ROWS__["invoice_line_items"];
__NEXEN_MOCK_ROWS__["recurringBills"] = __NEXEN_MOCK_ROWS__["recurring_bills"];
__NEXEN_MOCK_ROWS__["recurring-bills"] = __NEXEN_MOCK_ROWS__["recurring_bills"];
__NEXEN_MOCK_ROWS__["cashflow-forecasts"] = __NEXEN_MOCK_ROWS__["cashflow_forecasts"];
__NEXEN_MOCK_ROWS__["cashflowForecasts"] = __NEXEN_MOCK_ROWS__["cashflow_forecasts"];
__NEXEN_MOCK_ROWS__["health-scores"] = __NEXEN_MOCK_ROWS__["health_scores"];
__NEXEN_MOCK_ROWS__["healthScores"] = __NEXEN_MOCK_ROWS__["health_scores"];

// ── Sample-data changes: kept for this browser tab ──────────────────────────
const __NEXEN_SAMPLE_KEY__ = 'nexen.sample.c6b52a86d89d';
let __sampleLoaded = false;
const __sampleCreated = new Set<string>();
const __sampleAnswered = new WeakMap<object, any>();
function __sampleTables(): string[] {
  const keys = Object.keys(__NEXEN_MOCK_ROWS__);
  return keys.filter((k, i) => keys.findIndex((j) => __NEXEN_MOCK_ROWS__[j] === __NEXEN_MOCK_ROWS__[k]) === i);
}
function __sampleLoad(): void {
  if (__sampleLoaded) return;
  __sampleLoaded = true;
  try {
    const saved = JSON.parse(globalThis.sessionStorage?.getItem(__NEXEN_SAMPLE_KEY__) ?? 'null');
    if (!saved || typeof saved !== 'object') return;
    for (const t of __sampleTables()) {
      const kept = saved.rows?.[t];
      if (Array.isArray(kept)) __NEXEN_MOCK_ROWS__[t].splice(0, __NEXEN_MOCK_ROWS__[t].length, ...kept);
    }
    for (const id of Array.isArray(saved.created) ? saved.created : []) __sampleCreated.add(String(id));
  } catch { /* blocked or unreadable storage: the sample rows as shipped */ }
}
function __sampleSave(): void {
  try {
    const rows: Record<string, any[]> = {};
    for (const t of __sampleTables()) rows[t] = __NEXEN_MOCK_ROWS__[t];
    globalThis.sessionStorage?.setItem(__NEXEN_SAMPLE_KEY__, JSON.stringify({ rows, created: Array.from(__sampleCreated) }));
  } catch { /* full or blocked: kept until the page reloads */ }
  // The IDE preview says, once, that this went to sample data only.
  try {
    if (typeof window !== 'undefined' && window.parent !== window) window.parent.postMessage({ type: 'nexen:sample-write' }, '*');
  } catch { /* no preview around this page */ }
}
function __sampleFind(all: any[], id: string): number {
  return all.findIndex((r) => String(r.id) === String(id) || String(r.slug) === String(id));
}
/** A field the person did not fill, as a new row of theirs would hold it. Links and
 *  status-like values keep a sample row's (pages read them); its text, dates and counts do
 *  not: a new habit showed "Sample description for record 1" and its reminder. */
function __sampleBlank(k: string, v: any): any {
  if (/(Id|_id)$/.test(k) || /status|state|role|type|kind|priority|category|level|currency|unit|visibility/i.test(k)) return v;
  if (Array.isArray(v)) return [];
  if (v && typeof v === 'object') return v;
  if (typeof v === 'number') return 0;
  if (typeof v === 'boolean') return false;
  return null;
}
/** A new row: a sample row's fields (what pages read), the person's values in them. */
function __sampleInsert(table: string, body: any, links?: Record<string, string>): any {
  if (body && typeof body === 'object' && __sampleAnswered.has(body)) return __sampleAnswered.get(body);
  __sampleLoad();
  const all = __NEXEN_MOCK_ROWS__[table] ?? (__NEXEN_MOCK_ROWS__[table] = []);
  const like: any = all[0] ?? {};
  const now = new Date().toISOString();
  const row: any = {};
  for (const [k, v] of Object.entries(like)) row[k] = __sampleBlank(k, v);
  Object.assign(row, body && typeof body === 'object' ? body : {}, links ?? {});
  row.id = typeof like.id === 'number'
    ? all.reduce((m: number, r: any) => Math.max(m, Number(r.id) || 0), 0) + 1
    : (globalThis.crypto?.randomUUID?.() ?? `sample-${Date.now().toString(36)}`);
  if ('slug' in like && !(body && body.slug)) row.slug = String(row.id);
  for (const k of ['createdAt', 'updatedAt', 'created_at', 'updated_at']) if (k in like) row[k] = now;
  all.unshift(row);
  __sampleCreated.add(String(row.id));
  if (body && typeof body === 'object') __sampleAnswered.set(body, row);
  __sampleSave();
  return row;
}
function __sampleUpdate(table: string, id: string, body: any): any {
  __sampleLoad();
  const all = __NEXEN_MOCK_ROWS__[table] ?? [];
  const changes: any = { ...(body && typeof body === 'object' ? body : {}) };
  delete changes.id;
  const i = __sampleFind(all, id);
  if (i < 0) return { ...__mockRow(table, id), ...changes };
  Object.assign(all[i], changes);
  for (const k of ['updatedAt', 'updated_at']) if (k in all[i]) all[i][k] = new Date().toISOString();
  __sampleSave();
  return all[i];
}
function __sampleDelete(table: string, id: string): undefined {
  __sampleLoad();
  const all = __NEXEN_MOCK_ROWS__[table] ?? [];
  const i = __sampleFind(all, id);
  if (i >= 0) {
    all.splice(i, 1);
    __sampleSave();
  }
  return undefined;
}
/** A write no designed endpoint answers, applied to the table its path names. */
function __sampleWrite(method: string, path: string, body: any): any {
  const segs = path.split('/').filter(Boolean);
  for (let i = segs.length - 1; i >= 0; i -= 1) {
    if (!__NEXEN_MOCK_ROWS__[segs[i]]) continue;
    if (i === segs.length - 1 && method === 'POST') return __sampleInsert(segs[i], body);
    if (i === segs.length - 2 && (method === 'PATCH' || method === 'PUT')) return __sampleUpdate(segs[i], decodeURIComponent(segs[i + 1]), body);
    if (i === segs.length - 2 && method === 'DELETE') return __sampleDelete(segs[i], decodeURIComponent(segs[i + 1]));
    return undefined;
  }
  return undefined;
}

function __mockRows(table: string, where?: Record<string, string>): any[] {
  __sampleLoad();
  const all = __NEXEN_MOCK_ROWS__[table] ?? [];
  if (!where || !Object.keys(where).length) return all;
  const hit = all.filter((r) => Object.entries(where).every(([k, v]) => String(r[k]) === String(v)));
  // A parent added in this tab has no children yet: none, not every sample row.
  return hit.length || Object.values(where).some((v) => __sampleCreated.has(String(v))) ? hit : all;
}

function __mockRow(table: string, id?: string): any {
  __sampleLoad();
  const all = __NEXEN_MOCK_ROWS__[table] ?? [];
  return (id !== undefined && all.find((r) => String(r.id) === String(id) || String(r.slug) === String(id))) || all[0] || {};
}

/** One answer per designed endpoint, in the shape the API Layer declares for it. */
const __NEXEN_MOCK_ROUTES__: Array<[string, RegExp, (p: string[], body: any) => any]> = [
  ["POST", /^\/api\/admin\/weekly-business-review\/priorities$/, (p, body) => __mockRows("tasks")],
  ["POST", /^\/api\/my\/weekly-business-review\/priorities$/, (p, body) => __mockRows("tasks")],
  ["POST", /^\/api\/admin\/cashflow-forecasts\/generate$/, (p, body) => __mockRows("cashflow_forecasts")],
  ["POST", /^\/api\/admin\/health-scores\/recalculate$/, (p, body) => ({ "overall_score": 3, "project_consistency_score": 3, "payment_collection_score": 3, "cashflow_stability_score": 3, "workload_score": 3, "expense_management_score": 3, "generated_at": "2026-01-15T10:00:00Z", "drivers": ({ "project_consistency": "sample_project_consistency_1", "payment_collection": "sample_payment_collection_1", "cashflow_stability": "sample_cashflow_stability_1", "workload": "sample_workload_1", "expense_management": "sample_expense_management_1" }) })],
  ["POST", /^\/api\/my\/cashflow-forecasts\/generate$/, (p, body) => __mockRows("cashflow_forecasts")],
  ["POST", /^\/api\/my\/health-scores\/recalculate$/, (p, body) => ({ "overall_score": 3, "project_consistency_score": 3, "payment_collection_score": 3, "cashflow_stability_score": 3, "workload_score": 3, "expense_management_score": 3, "generated_at": "2026-01-15T10:00:00Z", "drivers": ({ "project_consistency": "sample_project_consistency_1", "payment_collection": "sample_payment_collection_1", "cashflow_stability": "sample_cashflow_stability_1", "workload": "sample_workload_1", "expense_management": "sample_expense_management_1" }) })],
  ["GET", /^\/api\/admin\/weekly-business-review$/, (p, body) => ({ "week_start": "sample_week_start_1", "completed_projects": __mockRows("projects"), "payments_collected": 3, "expenses_total": 3, "overdue_invoices": 3, "goal_progress": [3], "priorities": __mockRows("tasks") })],
  ["GET", /^\/api\/admin\/health-scores\/latest$/, (p, body) => ({ ...(__mockRow("health_scores")), ...(({ "drivers": [({ "area": "sample_area_1", "score": 3, "pulled_down_by": "sample_pulled_down_by_1" })] })) })],
  ["GET", /^\/api\/admin\/outstanding-payments$/, (p, body) => [({ "invoice_id": "invoice__001", "invoice_number": "sample_invoice_number_1", "client_id": "client__001", "client_name": "sample_client_name_1", "balance_due": 3, "due_date": "2026-01-15T10:00:00Z", "days_overdue": 3, "status": "active" })]],
  ["GET", /^\/api\/my\/weekly-business-review$/, (p, body) => ({ "week_start": "sample_week_start_1", "completed_projects": __mockRows("projects"), "payments_collected": 3, "expenses_total": 3, "overdue_invoices": 3, "goal_progress": [3], "priorities": __mockRows("tasks") })],
  ["POST", /^\/api\/admin\/insights\/generate$/, (p, body) => ({ "generated": 3, "insights": __mockRows("insights") })],
  ["GET", /^\/api\/admin\/cashflow-forecasts$/, (p, body) => __mockRows("cashflow_forecasts")],
  ["POST", /^\/api\/admin\/cashflow-forecasts$/, (p, body) => __mockRows("cashflow_forecasts")],
  ["GET", /^\/api\/my\/health-scores\/latest$/, (p, body) => ({ ...(__mockRow("health_scores")), ...(({ "drivers": [({ "area": "sample_area_1", "score": 3, "pulled_down_by": "sample_pulled_down_by_1" })] })) })],
  ["GET", /^\/api\/my\/outstanding-payments$/, (p, body) => [({ "invoice_id": "invoice__001", "invoice_number": "sample_invoice_number_1", "client_id": "client__001", "client_name": "sample_client_name_1", "balance_due": 3, "due_date": "2026-01-15T10:00:00Z", "days_overdue": 3, "status": "active" })]],
  ["GET", /^\/api\/admin\/workload-summary$/, (p, body) => [({ "week_start": "sample_week_start_1", "workload_percent": 3, "capacity_hours": 3, "open_task_count": 3, "active_project_count": 3 })]],
  ["GET", /^\/api\/admin\/recurring-bills$/, (p, body) => __mockRows("recurring_bills")],
  ["POST", /^\/api\/my\/insights\/generate$/, (p, body) => ({ "generated": 3, "insights": __mockRows("insights") })],
  ["GET", /^\/api\/my\/cashflow-forecasts$/, (p, body) => __mockRows("cashflow_forecasts")],
  ["POST", /^\/api\/my\/cashflow-forecasts$/, (p, body) => __mockRows("cashflow_forecasts")],
  ["GET", /^\/api\/admin\/goals\/workload$/, (p, body) => [({ "assignee_id": "assignee__001", "open_tasks": 3, "active_projects": 3, "load_percent": 3 })]],
  ["GET", /^\/api\/admin\/tasks-calendar$/, (p, body) => [({ "date": "2026-01-15T10:00:00Z", "kind": "sample_kind_1", "title": "Onboard new team members", "id": "id_001", "assignee_id": "assignee__001" })]],
  ["GET", /^\/api\/admin\/health-scores$/, (p, body) => ({ ...(__mockRow("health_scores")), ...(({ "drags": [({ "area": "sample_area_1", "score": 3, "reason": "sample_reason_1" })] })) })],
  ["POST", /^\/api\/admin\/health-scores$/, (p, body) => ({ ...(__sampleInsert("health_scores", body)), ...(({ "drags": [({ "area": "sample_area_1", "score": 3, "reason": "sample_reason_1" })] })) })],
  ["POST", /^\/api\/my\/quotes\/generate$/, (p, body) => __mockRow("quotes")],
  ["GET", /^\/api\/my\/recurring-bills$/, (p, body) => __mockRows("recurring_bills")],
  ["GET", /^\/api\/admin\/simulations$/, (p, body) => __mockRows("simulations")],
  ["POST", /^\/api\/admin\/simulations$/, (p, body) => __sampleInsert("simulations", body)],
  ["GET", /^\/api\/my\/tasks-calendar$/, (p, body) => [({ "date": "2026-01-15T10:00:00Z", "kind": "sample_kind_1", "title": "Onboard new team members", "id": "id_001" })]],
  ["GET", /^\/api\/my\/health-scores$/, (p, body) => ({ ...(__mockRow("health_scores")), ...(({ "drags": [({ "area": "sample_area_1", "score": 3, "reason": "sample_reason_1" })] })) })],
  ["POST", /^\/api\/my\/health-scores$/, (p, body) => ({ ...(__sampleInsert("health_scores", body)), ...(({ "drags": [({ "area": "sample_area_1", "score": 3, "reason": "sample_reason_1" })] })) })],
  ["POST", /^\/api\/my\/quotes\/today$/, (p, body) => __mockRow("quotes")],
  ["GET", /^\/api\/my\/quotes\/today$/, (p, body) => __mockRow("quotes")],
  ["GET", /^\/api\/admin\/dashboard$/, (p, body) => ({ "next_steps": __mockRows("insights"), "alerts": __mockRows("insights"), "upcoming_deadlines": [({ "project": __mockRow("projects"), "days_remaining": 3, "is_overdue": true })], "cashflow_summary": [({ "horizon_days": 3, "net_cashflow": 3, "shortfall_amount": 3 })] })],
  ["GET", /^\/api\/admin\/reminders$/, (p, body) => __mockRows("reminders")],
  ["GET", /^\/api\/my\/next-actions$/, (p, body) => __mockRows("insights")],
  ["GET", /^\/api\/admin\/projects$/, (p, body) => __mockRows("projects")],
  ["POST", /^\/api\/admin\/projects$/, (p, body) => __sampleInsert("projects", body)],
  ["GET", /^\/api\/admin\/invoices$/, (p, body) => __mockRows("invoices")],
  ["POST", /^\/api\/admin\/invoices$/, (p, body) => __sampleInsert("invoices", body)],
  ["GET", /^\/api\/admin\/expenses$/, (p, body) => []],
  ["POST", /^\/api\/recurring-bills$/, (p, body) => __sampleInsert("recurring_bills", body)],
  ["GET", /^\/api\/admin\/calendar$/, (p, body) => [({ "kind": "sample_kind_1", "id": "id_001", "title": "Onboard new team members", "date": "2026-01-15T10:00:00Z", "status": "active" })]],
  ["GET", /^\/api\/admin\/insights$/, (p, body) => __mockRows("insights")],
  ["GET", /^\/api\/goals\/workload$/, (p, body) => ({ "period_start": "sample_period_start_1", "period_end": "sample_period_end_1", "active_projects": 3, "target_project_count": 3, "completed_count": 3, "capacity_hours_per_week": 3, "load_ratio": 3 })],
  ["GET", /^\/api\/admin\/clients$/, (p, body) => __mockRows("clients").map((r: any) => ({ ...r, ...(({ "project_count": 3, "outstanding_balance": 3 })) }))],
  ["POST", /^\/api\/admin\/clients$/, (p, body) => __sampleInsert("clients", body)],
  ["GET", /^\/api\/my\/dashboard$/, (p, body) => ({ "next_steps": __mockRows("insights"), "alerts": __mockRows("insights"), "upcoming_deadlines": [({ "project": __mockRow("projects"), "days_remaining": 3, "is_overdue": true })], "cashflow_summary": [({ "horizon_days": 3, "net_cashflow": 3, "shortfall_amount": 3 })] })],
  ["GET", /^\/api\/my\/reminders$/, (p, body) => __mockRows("reminders")],
  ["GET", /^\/api\/admin\/users$/, (p, body) => __mockRows("users")],
  ["POST", /^\/api\/admin\/users$/, (p, body) => __sampleInsert("users", body)],
  ["GET", /^\/api\/my\/projects$/, (p, body) => __mockRows("projects")],
  ["POST", /^\/api\/my\/projects$/, (p, body) => __sampleInsert("projects", body)],
  ["GET", /^\/api\/my\/invoices$/, (p, body) => __mockRows("invoices")],
  ["POST", /^\/api\/my\/invoices$/, (p, body) => __sampleInsert("invoices", body)],
  ["GET", /^\/api\/my\/expenses$/, (p, body) => []],
  ["GET", /^\/api\/admin\/goals$/, (p, body) => [({ "goal": __mockRow("goals"), "completed_count": 3, "progress_percent": 3 })]],
  ["POST", /^\/api\/admin\/goals$/, (p, body) => __sampleInsert("goals", body)],
  ["GET", /^\/api\/my\/calendar$/, (p, body) => [({ "kind": "sample_kind_1", "id": "id_001", "title": "Onboard new team members", "date": "2026-01-15T10:00:00Z", "status": "active" })]],
  ["GET", /^\/api\/my\/insights$/, (p, body) => __mockRows("insights")],
  ["GET", /^\/api\/admin\/tasks$/, (p, body) => __mockRows("tasks")],
  ["GET", /^\/api\/my\/clients$/, (p, body) => __mockRows("clients").map((r: any) => ({ ...r, ...(({ "project_count": 3, "outstanding_balance": 3 })) }))],
  ["POST", /^\/api\/my\/clients$/, (p, body) => __sampleInsert("clients", body)],
  ["GET", /^\/api\/simulations$/, (p, body) => __mockRows("simulations")],
  ["POST", /^\/api\/simulations$/, (p, body) => __sampleInsert("simulations", body)],
  ["POST", /^\/api\/businesses$/, (p, body) => __sampleInsert("businesses", body)],
  ["GET", /^\/api\/my\/quotes$/, (p, body) => __mockRows("quotes")],
  ["GET", /^\/api\/my\/goals$/, (p, body) => __mockRows("goals")],
  ["GET", /^\/api\/my\/tasks$/, (p, body) => __mockRows("tasks")],
  ["POST", /^\/api\/reminders$/, (p, body) => __sampleInsert("reminders", body)],
  ["POST", /^\/api\/projects$/, (p, body) => __sampleInsert("projects", body)],
  ["POST", /^\/api\/invoices$/, (p, body) => __sampleInsert("invoices", body)],
  ["GET", /^\/api\/workload$/, (p, body) => [({ "assignee_id": "assignee__001", "open_task_count": 3, "project_deadline_count": 3, "workload_percent": 3 })]],
  ["POST", /^\/api\/clients$/, (p, body) => __sampleInsert("clients", body)],
  ["POST", /^\/api\/tasks$/, (p, body) => __sampleInsert("tasks", body)],
  ["POST", /^\/api\/goals$/, (p, body) => __sampleInsert("goals", body)],
  ["GET", /^\/api\/goals$/, (p, body) => [({ "goal": __mockRow("goals"), "completion_rate": 3 })]],
  ["POST", /^\/api\/admin\/recurring-bills\/([^\/]+)\/mark-paid$/, (p, body) => __mockRow("recurring_bills", p[0])],
  ["POST", /^\/api\/my\/recurring-bills\/([^\/]+)\/mark-paid$/, (p, body) => __mockRow("recurring_bills", p[0])],
  ["POST", /^\/api\/admin\/simulations\/([^\/]+)\/complete$/, (p, body) => ({ "simulation": __mockRow("simulations", p[0]), "horizons": [({ "horizon_days": 3, "baseline_inflow": 3, "projected_inflow": 3, "projected_balance": 3, "shortfall_amount": 3 })] })],
  ["POST", /^\/api\/my\/quotes\/([^\/]+)\/accept-challenge$/, (p, body) => __mockRow("tasks")],
  ["POST", /^\/api\/admin\/invoices\/([^\/]+)\/line-items$/, (p, body) => __sampleInsert("invoice_line_items", body, { invoiceId: p[0] })],
  ["POST", /^\/api\/recurring-bills\/([^\/]+)\/mark-paid$/, (p, body) => __mockRow("recurring_bills", p[0])],
  ["POST", /^\/api\/admin\/projects\/([^\/]+)\/complete$/, (p, body) => __mockRow("projects", p[0])],
  ["POST", /^\/api\/admin\/reminders\/([^\/]+)\/approve$/, (p, body) => __mockRow("reminders", p[0])],
  ["POST", /^\/api\/admin\/insights\/([^\/]+)\/complete$/, (p, body) => __mockRow("insights", p[0])],
  ["POST", /^\/api\/my\/invoices\/([^\/]+)\/line-items$/, (p, body) => __sampleInsert("invoice_line_items", body, { invoiceId: p[0] })],
  ["POST", /^\/api\/admin\/insights\/([^\/]+)\/dismiss$/, (p, body) => __mockRow("insights", p[0])],
  ["POST", /^\/api\/admin\/users\/([^\/]+)\/deactivate$/, (p, body) => ({ "id": "id_001", "email": "jane.doe@example.com", "name": "Jane Doe", "role": "admin", "is_active": true })],
  ["POST", /^\/api\/admin\/users\/([^\/]+)\/reactivate$/, (p, body) => ({ "id": "id_001", "email": "jane.doe@example.com", "name": "Jane Doe", "role": "admin", "is_active": true })],
  ["POST", /^\/api\/admin\/projects\/([^\/]+)\/cancel$/, (p, body) => __mockRow("projects", p[0])],
  ["POST", /^\/api\/recurring-bills\/([^\/]+)\/resume$/, (p, body) => __mockRow("recurring_bills", p[0])],
  ["POST", /^\/api\/admin\/simulations\/([^\/]+)\/run$/, (p, body) => ({ "simulation": __mockRow("simulations", p[0]), "baseline_balance": 3, "projected_balance": 3, "shortfall_amount": 3 })],
  ["POST", /^\/api\/my\/projects\/([^\/]+)\/complete$/, (p, body) => __mockRow("projects", p[0])],
  ["POST", /^\/api\/my\/reminders\/([^\/]+)\/approve$/, (p, body) => __mockRow("reminders", p[0])],
  ["POST", /^\/api\/admin\/reminders\/([^\/]+)\/send$/, (p, body) => __mockRow("reminders", p[0])],
  ["PATCH", /^\/api\/admin\/recurring-bills\/([^\/]+)$/, (p, body) => __sampleUpdate("recurring_bills", p[0], body)],
  ["DELETE", /^\/api\/admin\/recurring-bills\/([^\/]+)$/, (p, body) => __sampleDelete("recurring_bills", p[0])],
  ["POST", /^\/api\/admin\/tasks\/([^\/]+)\/complete$/, (p, body) => __mockRow("tasks", p[0])],
  ["POST", /^\/api\/my\/insights\/([^\/]+)\/complete$/, (p, body) => __mockRow("insights", p[0])],
  ["POST", /^\/api\/admin\/projects\/([^\/]+)\/start$/, (p, body) => __mockRow("projects", p[0])],
  ["POST", /^\/api\/recurring-bills\/([^\/]+)\/pause$/, (p, body) => __mockRow("recurring_bills", p[0])],
  ["POST", /^\/api\/admin\/invoices\/([^\/]+)\/send$/, (p, body) => __mockRow("invoices", p[0])],
  ["POST", /^\/api\/my\/insights\/([^\/]+)\/dismiss$/, (p, body) => __mockRow("insights", p[0])],
  ["POST", /^\/api\/my\/projects\/([^\/]+)\/cancel$/, (p, body) => __mockRow("projects", p[0])],
  ["POST", /^\/api\/recurring-bills\/([^\/]+)\/end$/, (p, body) => __mockRow("recurring_bills", p[0])],
  ["GET", /^\/api\/invoices\/([^\/]+)\/line-items$/, (p, body) => __mockRows("invoice_line_items", { invoiceId: p[0] })],
  ["POST", /^\/api\/invoices\/([^\/]+)\/line-items$/, (p, body) => __sampleInsert("invoice_line_items", body, { invoiceId: p[0] })],
  ["POST", /^\/api\/invoices\/([^\/]+)\/reminders$/, (p, body) => __sampleInsert("reminders", body, { invoiceId: p[0] })],
  ["POST", /^\/api\/my\/reminders\/([^\/]+)\/send$/, (p, body) => __mockRow("reminders", p[0])],
  ["PATCH", /^\/api\/my\/recurring-bills\/([^\/]+)$/, (p, body) => __sampleUpdate("recurring_bills", p[0], body)],
  ["DELETE", /^\/api\/my\/recurring-bills\/([^\/]+)$/, (p, body) => __sampleDelete("recurring_bills", p[0])],
  ["POST", /^\/api\/my\/tasks\/([^\/]+)\/complete$/, (p, body) => __mockRow("tasks", p[0])],
  ["POST", /^\/api\/my\/projects\/([^\/]+)\/start$/, (p, body) => __mockRow("projects", p[0])],
  ["POST", /^\/api\/my\/invoices\/([^\/]+)\/send$/, (p, body) => __mockRow("invoices", p[0])],
  ["GET", /^\/api\/invoices\/([^\/]+)\/payments$/, (p, body) => __mockRows("payments", { invoiceId: p[0] })],
  ["POST", /^\/api\/invoices\/([^\/]+)\/payments$/, (p, body) => __sampleInsert("payments", body, { invoiceId: p[0] })],
  ["GET", /^\/api\/admin\/simulations\/([^\/]+)$/, (p, body) => ({ "simulation": __mockRow("simulations", p[0]), "horizons": [({ "horizon_days": 3, "baseline_inflow": 3, "projected_inflow": 3, "projected_balance": 3, "shortfall_amount": 3 })] })],
  ["PATCH", /^\/api\/admin\/simulations\/([^\/]+)$/, (p, body) => __sampleUpdate("simulations", p[0], body)],
  ["DELETE", /^\/api\/admin\/simulations\/([^\/]+)$/, (p, body) => __sampleDelete("simulations", p[0])],
  ["POST", /^\/api\/reminders\/([^\/]+)\/approve$/, (p, body) => __mockRow("reminders", p[0])],
  ["POST", /^\/api\/payments\/([^\/]+)\/receive$/, (p, body) => __mockRow("payments", p[0])],
  ["PATCH", /^\/api\/admin\/reminders\/([^\/]+)$/, (p, body) => __sampleUpdate("reminders", p[0], body)],
  ["DELETE", /^\/api\/admin\/reminders\/([^\/]+)$/, (p, body) => __sampleDelete("reminders", p[0])],
  ["POST", /^\/api\/tasks\/([^\/]+)\/plan-week$/, (p, body) => __mockRow("tasks", p[0])],
  ["POST", /^\/api\/simulations\/([^\/]+)\/run$/, (p, body) => ({ "simulation": __mockRow("simulations", p[0]), "projected_payment_date": "2026-01-15T10:00:00Z", "baseline_balance": 3, "projected_balance": 3, "shortfall_amount": 3 })],
  ["GET", /^\/api\/admin\/projects\/([^\/]+)$/, (p, body) => ({ ...(__mockRow("projects", p[0])), ...(({ "client": __mockRow("clients"), "invoices": __mockRows("invoices", { projectId: p[0] }) })) })],
  ["PATCH", /^\/api\/admin\/projects\/([^\/]+)$/, (p, body) => __sampleUpdate("projects", p[0], body)],
  ["GET", /^\/api\/admin\/invoices\/([^\/]+)$/, (p, body) => ({ ...(__mockRow("invoices", p[0])), ...(({ "line_items": __mockRows("invoice_line_items", { invoiceId: p[0] }), "payments": __mockRows("payments", { invoiceId: p[0] }) })) })],
  ["PATCH", /^\/api\/admin\/invoices\/([^\/]+)$/, (p, body) => __sampleUpdate("invoices", p[0], body)],
  ["DELETE", /^\/api\/admin\/invoices\/([^\/]+)$/, (p, body) => __sampleDelete("invoices", p[0])],
  ["DELETE", /^\/api\/admin\/expenses\/([^\/]+)$/, (p, body) => __sampleDelete("expen", p[0])],
  ["DELETE", /^\/api\/admin\/projects\/([^\/]+)$/, (p, body) => __sampleDelete("projects", p[0])],
  ["POST", /^\/api\/reminders\/([^\/]+)\/send$/, (p, body) => __mockRow("reminders", p[0])],
  ["GET", /^\/api\/recurring-bills\/([^\/]+)$/, (p, body) => __mockRow("recurring_bills", p[0])],
  ["PATCH", /^\/api\/recurring-bills\/([^\/]+)$/, (p, body) => __sampleUpdate("recurring_bills", p[0], body)],
  ["DELETE", /^\/api\/recurring-bills\/([^\/]+)$/, (p, body) => __sampleDelete("recurring_bills", p[0])],
  ["POST", /^\/api\/tasks\/([^\/]+)\/complete$/, (p, body) => __mockRow("tasks", p[0])],
  ["GET", /^\/api\/admin\/clients\/([^\/]+)$/, (p, body) => ({ ...(__mockRow("clients", p[0])), ...(({ "projects": __mockRows("projects", { clientId: p[0] }), "invoices": __mockRows("invoices", { clientId: p[0] }) })) })],
  ["PATCH", /^\/api\/admin\/clients\/([^\/]+)$/, (p, body) => __sampleUpdate("clients", p[0], body)],
  ["DELETE", /^\/api\/admin\/clients\/([^\/]+)$/, (p, body) => __sampleDelete("clients", p[0])],
  ["POST", /^\/api\/invoices\/([^\/]+)\/send$/, (p, body) => __mockRow("invoices", p[0])],
  ["PATCH", /^\/api\/my\/reminders\/([^\/]+)$/, (p, body) => __sampleUpdate("reminders", p[0], body)],
  ["DELETE", /^\/api\/my\/reminders\/([^\/]+)$/, (p, body) => __sampleDelete("reminders", p[0])],
  ["PATCH", /^\/api\/admin\/users\/([^\/]+)$/, (p, body) => __sampleUpdate("users", p[0], body)],
  ["GET", /^\/api\/my\/projects\/([^\/]+)$/, (p, body) => ({ ...(__mockRow("projects", p[0])), ...(({ "client": __mockRow("clients"), "invoices": __mockRows("invoices", { projectId: p[0] }) })) })],
  ["PATCH", /^\/api\/my\/projects\/([^\/]+)$/, (p, body) => __sampleUpdate("projects", p[0], body)],
  ["GET", /^\/api\/my\/invoices\/([^\/]+)$/, (p, body) => ({ ...(__mockRow("invoices", p[0])), ...(({ "line_items": __mockRows("invoice_line_items", { invoiceId: p[0] }), "payments": __mockRows("payments", { invoiceId: p[0] }) })) })],
  ["PATCH", /^\/api\/my\/invoices\/([^\/]+)$/, (p, body) => __sampleUpdate("invoices", p[0], body)],
  ["DELETE", /^\/api\/my\/invoices\/([^\/]+)$/, (p, body) => __sampleDelete("invoices", p[0])],
  ["DELETE", /^\/api\/my\/expenses\/([^\/]+)$/, (p, body) => __sampleDelete("expen", p[0])],
  ["PATCH", /^\/api\/admin\/goals\/([^\/]+)$/, (p, body) => __sampleUpdate("goals", p[0], body)],
  ["DELETE", /^\/api\/admin\/goals\/([^\/]+)$/, (p, body) => __sampleDelete("goals", p[0])],
  ["PATCH", /^\/api\/admin\/tasks\/([^\/]+)$/, (p, body) => __sampleUpdate("tasks", p[0], body)],
  ["DELETE", /^\/api\/admin\/tasks\/([^\/]+)$/, (p, body) => __sampleDelete("tasks", p[0])],
  ["DELETE", /^\/api\/my\/projects\/([^\/]+)$/, (p, body) => __sampleDelete("projects", p[0])],
  ["GET", /^\/api\/my\/clients\/([^\/]+)$/, (p, body) => ({ ...(__mockRow("clients", p[0])), ...(({ "projects": __mockRows("projects", { clientId: p[0] }), "invoices": __mockRows("invoices", { clientId: p[0] }) })) })],
  ["PATCH", /^\/api\/my\/clients\/([^\/]+)$/, (p, body) => __sampleUpdate("clients", p[0], body)],
  ["DELETE", /^\/api\/my\/clients\/([^\/]+)$/, (p, body) => __sampleDelete("clients", p[0])],
  ["GET", /^\/api\/simulations\/([^\/]+)$/, (p, body) => __mockRow("simulations", p[0])],
  ["PATCH", /^\/api\/simulations\/([^\/]+)$/, (p, body) => __sampleUpdate("simulations", p[0], body)],
  ["DELETE", /^\/api\/simulations\/([^\/]+)$/, (p, body) => __sampleDelete("simulations", p[0])],
  ["GET", /^\/api\/businesses\/([^\/]+)$/, (p, body) => __mockRow("businesses", p[0])],
  ["PATCH", /^\/api\/businesses\/([^\/]+)$/, (p, body) => __sampleUpdate("businesses", p[0], body)],
  ["PATCH", /^\/api\/my\/quotes\/([^\/]+)$/, (p, body) => __sampleUpdate("quotes", p[0], body)],
  ["DELETE", /^\/api\/my\/quotes\/([^\/]+)$/, (p, body) => __sampleDelete("quotes", p[0])],
  ["PATCH", /^\/api\/line-items\/([^\/]+)$/, (p, body) => __sampleUpdate("invoice_line_items", p[0], body)],
  ["DELETE", /^\/api\/line-items\/([^\/]+)$/, (p, body) => __sampleDelete("invoice_line_items", p[0])],
  ["PATCH", /^\/api\/my\/tasks\/([^\/]+)$/, (p, body) => __sampleUpdate("tasks", p[0], body)],
  ["DELETE", /^\/api\/my\/tasks\/([^\/]+)$/, (p, body) => __sampleDelete("tasks", p[0])],
  ["GET", /^\/api\/reminders\/([^\/]+)$/, (p, body) => __mockRow("reminders", p[0])],
  ["PATCH", /^\/api\/reminders\/([^\/]+)$/, (p, body) => __sampleUpdate("reminders", p[0], body)],
  ["DELETE", /^\/api\/reminders\/([^\/]+)$/, (p, body) => __sampleDelete("reminders", p[0])],
  ["PATCH", /^\/api\/payments\/([^\/]+)$/, (p, body) => __sampleUpdate("payments", p[0], body)],
  ["GET", /^\/api\/payments\/([^\/]+)$/, (p, body) => __mockRow("payments", p[0])],
  ["DELETE", /^\/api\/expenses\/([^\/]+)$/, (p, body) => __sampleDelete("expen", p[0])],
  ["GET", /^\/api\/projects\/([^\/]+)$/, (p, body) => ({ "project": __mockRow("projects", p[0]), "client": __mockRow("clients"), "tasks": __mockRows("tasks", { projectId: p[0] }), "invoices": __mockRows("invoices", { projectId: p[0] }) })],
  ["PATCH", /^\/api\/projects\/([^\/]+)$/, (p, body) => __sampleUpdate("projects", p[0], body)],
  ["DELETE", /^\/api\/projects\/([^\/]+)$/, (p, body) => __sampleDelete("projects", p[0])],
  ["GET", /^\/api\/invoices\/([^\/]+)$/, (p, body) => ({ "invoice": __mockRow("invoices", p[0]), "line_items": __mockRows("invoice_line_items", { invoiceId: p[0] }), "payments": __mockRows("payments", { invoiceId: p[0] }), "client": __mockRow("clients"), "project": __mockRow("projects") })],
  ["PATCH", /^\/api\/invoices\/([^\/]+)$/, (p, body) => __sampleUpdate("invoices", p[0], body)],
  ["DELETE", /^\/api\/invoices\/([^\/]+)$/, (p, body) => __sampleDelete("invoices", p[0])],
  ["GET", /^\/api\/clients\/([^\/]+)$/, (p, body) => ({ "client": __mockRow("clients", p[0]), "projects": __mockRows("projects", { clientId: p[0] }), "invoices": __mockRows("invoices", { clientId: p[0] }), "payments": __mockRows("payments", { clientId: p[0] }) })],
  ["PATCH", /^\/api\/clients\/([^\/]+)$/, (p, body) => __sampleUpdate("clients", p[0], body)],
  ["DELETE", /^\/api\/clients\/([^\/]+)$/, (p, body) => __sampleDelete("clients", p[0])],
  ["GET", /^\/api\/goals\/([^\/]+)$/, (p, body) => __mockRow("goals", p[0])],
  ["PATCH", /^\/api\/goals\/([^\/]+)$/, (p, body) => __sampleUpdate("goals", p[0], body)],
  ["DELETE", /^\/api\/goals\/([^\/]+)$/, (p, body) => __sampleDelete("goals", p[0])],
  ["GET", /^\/api\/tasks\/([^\/]+)$/, (p, body) => __mockRow("tasks", p[0])],
  ["PATCH", /^\/api\/tasks\/([^\/]+)$/, (p, body) => __sampleUpdate("tasks", p[0], body)],
  ["DELETE", /^\/api\/tasks\/([^\/]+)$/, (p, body) => __sampleDelete("tasks", p[0])],
  ["PATCH", /^\/api\/admin\/invoices\/([^\/]+)\/line-items\/([^\/]+)$/, (p, body) => __sampleUpdate("invoice_line_items", p[1], body)],
  ["DELETE", /^\/api\/admin\/invoices\/([^\/]+)\/line-items\/([^\/]+)$/, (p, body) => __sampleDelete("invoice_line_items", p[1])],
  ["PATCH", /^\/api\/my\/invoices\/([^\/]+)\/line-items\/([^\/]+)$/, (p, body) => __sampleUpdate("invoice_line_items", p[1], body)],
  ["DELETE", /^\/api\/my\/invoices\/([^\/]+)\/line-items\/([^\/]+)$/, (p, body) => __sampleDelete("invoice_line_items", p[1])],
  ["PATCH", /^\/api\/invoices\/([^\/]+)\/line-items\/([^\/]+)$/, (p, body) => ({ "line_item": __sampleUpdate("invoice_line_items", p[1], body), "invoice": __mockRow("invoices", p[0]) })],
  ["DELETE", /^\/api\/invoices\/([^\/]+)\/line-items\/([^\/]+)$/, (p, body) => __sampleDelete("invoice_line_items", p[1])],
];

/** What `http()` returns in mock mode. Sign-in paths hand back the demo
 *  session @/lib/authContext uses. Every endpoint the API Layer designed
 *  answers in its own declared shape (`__NEXEN_MOCK_ROUTES__`), built from
 *  the same sample rows the database seed uses, and passed through the
 *  same `unwrap` a real answer gets — so a screen that works here reads
 *  the fields it will read against the real routes.
 *
 *  The `/me` rule is anchored to the END of the path: unanchored, it
 *  caught `/api/me/orders` and answered every "my ..." screen with the
 *  demo user. */
function __nexenMockResponse(url: string, init?: RequestInit): any {
  const method = (init?.method ?? 'GET').toUpperCase();
  const __path = String(url).split('?')[0].replace(/\/+$/, '') || '/';
  __sampleLoad();
  if (/\/(login|register|signup|sign-up|sign-in|signin)$/.test(__path)) {
    return { token: 'nexen-mock-token', user: __NEXEN_DEMO_USER__ };
  }
  if (/\/(logout|sign-out|signout)$/.test(__path)) return { ok: true };
  let __body: any = {};
  try { __body = init?.body ? JSON.parse(String(init.body)) : {}; } catch { __body = {}; }
  for (const [m, re, answer] of __NEXEN_MOCK_ROUTES__) {
    if (m !== method) continue;
    const hit = re.exec(__path);
    if (hit) return unwrap(answer(hit.slice(1).map(decodeURIComponent), __body));
  }
  if (method === 'GET' && /\/auth\/(me|session|user)$|^\/api\/(me|profile)$|\/users\/me$/.test(__path)) {
    return __NEXEN_DEMO_USER__;
  }
  // No designed answer: a write changes the rows its path names, kept for this
  // tab (`__sampleWrite`); else it echoes its body so optimistic UI still
  // renders. A read finds the rows its path names.
  if (method !== 'GET') {
    const written = __sampleWrite(method, __path, __body);
    if (written !== undefined || method === 'DELETE') return written;
  }
  if (method !== 'GET' && init?.body) return __body;
  const __segs = __path.split('/').filter(Boolean);
  for (let i = __segs.length - 1; i >= 0; i -= 1) {
    const rows = __NEXEN_MOCK_ROWS__[__segs[i]];
    if (!rows) continue;
    const isItem = i === __segs.length - 2;
    return isItem ? __mockRow(__segs[i], __segs[i + 1]) : rows;
  }
  return {};
}

import type { Business } from '@/types/business';
import type { CashflowForecast } from '@/types/cashflowforecast';
import type { Client } from '@/types/client';
import type { Expens } from '@/types/expens';
import type { Goal } from '@/types/goal';
import type { HealthScore } from '@/types/healthscore';
import type { Insight } from '@/types/insight';
import type { Invoice } from '@/types/invoice';
import type { InvoiceLineItem } from '@/types/invoicelineitem';
import type { Payment } from '@/types/payment';
import type { Project } from '@/types/project';
import type { Quote } from '@/types/quote';
import type { RecurringBill } from '@/types/recurringbill';
import type { Reminder } from '@/types/reminder';
import type { Simulation } from '@/types/simulation';
import type { Task } from '@/types/task';
import type { User } from '@/types/user';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function withQuery(
  url: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  if (!query) return url;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${url}?${s}` : url;
}

// ONE envelope convention, applied here so nothing downstream has to think
// about it: route handlers return the entity WRAPPED — `{ task }`, `{ projects }`
// — matching the `{ error }` shape errors already use and leaving room for
// `{ data, meta }` later. This unwraps it, so hooks and pages only ever see
// entities.
//
// Without a single decision, some generated consumers unwrapped and some did
// not: `useTask` stored `{ task: {...} }` as the task itself while the page
// next to it got it right. Both were plausible readings of an unstated rule.
function unwrap(payload: any): any {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return payload;
  }
  const keys = Object.keys(payload);
  // A single-key object whose key is not a known envelope field IS the
  // envelope. Anything else is already the entity — unwrapping a real
  // one-field entity would be worse than leaving a wrapper on.
  if (keys.length === 1 && !['error', 'message', 'ok'].includes(keys[0])) {
    return payload[keys[0]];
  }
  return payload;
}

async function http(url: string, init?: RequestInit): Promise<any> {
  // No database exists during the preview — answer locally.
  if (__NEXEN_IS_MOCK__) return __nexenMockResponse(url, init);
  // Unified-Next: same-origin relative URLs. Auth is DUAL — the login route
  // sets an httpOnly session cookie AND returns the JWT, which the login form
  // persists via @/lib/authToken. We attach it as `Authorization: Bearer` here
  // because the cookie is withheld inside the IDE preview's cross-site iframe;
  // `credentials: 'include'` keeps the cookie working in a normal browser too.
  const token = typeof window !== 'undefined' ? getToken() : null;
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...((init?.headers as Record<string, string> | undefined) ?? {}),
    },
  });
  if (!res.ok) {
    throw new ApiError(res.status, await res.text().catch(() => res.statusText));
  }
  if (res.status === 204) return undefined;
  return unwrap(await res.json().catch(() => undefined));
}

export async function createAuthRegister(input: { email: string; password: string; name: string }): Promise<User> {
  return http(`/api/auth/register`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAuthLogin(input: { email: string; password: string }): Promise<any> {
  return http(`/api/auth/login`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAuthLogout(input: Record<string, unknown>): Promise<boolean> {
  return http(`/api/auth/logout`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getAuthMe(query?: Record<string, string | number | boolean | undefined>): Promise<User> {
  return http(withQuery(`/api/auth/me`, query));
}
export async function updateAuthMe(input: Partial<User>): Promise<User> {
  return http(`/api/auth/me`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function createAuthChangePassword(input: { current_password: string; new_password: string }): Promise<{ changed: boolean; password_changed_at: string }> {
  return http(`/api/auth/change-password`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAuthForgotPassword(input: { email: string }): Promise<{ message: string }> {
  return http(`/api/auth/forgot-password`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAuthResetPassword(input: { token: string; password: string }): Promise<boolean> {
  return http(`/api/auth/reset-password`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getAdminUsers(query?: Record<string, string | number | boolean | undefined>): Promise<User[]> {
  return http(withQuery(`/api/admin/users`, query));
}
export async function createAdminUser(input: Partial<Omit<User, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<User> {
  return http(`/api/admin/users`, { method: 'POST', body: JSON.stringify(input) });
}
export async function updateAdminUser(userId: string, input: Partial<Omit<User, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<User> {
  return http(`/api/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function createBusiness(input: Partial<Omit<Business, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Business> {
  return http(`/api/businesses`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getBusinessById(businessId: string, query?: Record<string, string | number | boolean | undefined>): Promise<Business> {
  return http(withQuery(`/api/businesses/${businessId}`, query));
}
export async function updateBusiness(businessId: string, input: Partial<Omit<Business, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Business> {
  return http(`/api/businesses/${businessId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function getMyDashboard(query?: Record<string, string | number | boolean | undefined>): Promise<{ next_steps: Insight[]; alerts: Insight[]; upcoming_deadlines: Array<{ project: Project; days_remaining: number; is_overdue: boolean }>; cashflow_summary: Array<{ horizon_days: number; net_cashflow: number; shortfall_amount: number }> }> {
  return http(withQuery(`/api/my/dashboard`, query));
}
export async function getAdminDashboard(query?: Record<string, string | number | boolean | undefined>): Promise<{ next_steps: Insight[]; alerts: Insight[]; upcoming_deadlines: Array<{ project: Project; days_remaining: number; is_overdue: boolean }>; cashflow_summary: Array<{ horizon_days: number; net_cashflow: number; shortfall_amount: number }> }> {
  return http(withQuery(`/api/admin/dashboard`, query));
}
export async function getMyClients(query?: Record<string, string | number | boolean | undefined>): Promise<(Client & { project_count: number; outstanding_balance: number })[]> {
  return http(withQuery(`/api/my/clients`, query));
}
export async function createMyClient(input: Partial<Omit<Client, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Client> {
  return http(`/api/my/clients`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getMyClientById(clientId: string, query?: Record<string, string | number | boolean | undefined>): Promise<Client & { projects: Project[]; invoices: Invoice[] }> {
  return http(withQuery(`/api/my/clients/${clientId}`, query));
}
export async function updateMyClient(clientId: string, input: Partial<Omit<Client, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Client> {
  return http(`/api/my/clients/${clientId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function getAdminClients(query?: Record<string, string | number | boolean | undefined>): Promise<(Client & { project_count: number; outstanding_balance: number })[]> {
  return http(withQuery(`/api/admin/clients`, query));
}
export async function createAdminClient(input: Partial<Omit<Client, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Client> {
  return http(`/api/admin/clients`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getAdminClientById(clientId: string, query?: Record<string, string | number | boolean | undefined>): Promise<Client & { projects: Project[]; invoices: Invoice[] }> {
  return http(withQuery(`/api/admin/clients/${clientId}`, query));
}
export async function updateAdminClient(clientId: string, input: Partial<Omit<Client, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Client> {
  return http(`/api/admin/clients/${clientId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function getMyProjects(query?: Record<string, string | number | boolean | undefined>): Promise<Project[]> {
  return http(withQuery(`/api/my/projects`, query));
}
export async function createMyProject(input: Partial<Omit<Project, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Project> {
  return http(`/api/my/projects`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getMyProjectById(projectId: string, query?: Record<string, string | number | boolean | undefined>): Promise<Project & { client: Client; invoices: Invoice[] }> {
  return http(withQuery(`/api/my/projects/${projectId}`, query));
}
export async function updateMyProject(projectId: string, input: Partial<Omit<Project, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Project> {
  return http(`/api/my/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function createMyProjectComplete(projectId: string, input: Record<string, unknown>): Promise<Project> {
  return http(`/api/my/projects/${projectId}/complete`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createMyProjectCancel(projectId: string, input: Record<string, unknown>): Promise<Project> {
  return http(`/api/my/projects/${projectId}/cancel`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getAdminProjects(query?: Record<string, string | number | boolean | undefined>): Promise<Project[]> {
  return http(withQuery(`/api/admin/projects`, query));
}
export async function createAdminProject(input: Partial<Omit<Project, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Project> {
  return http(`/api/admin/projects`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getAdminProjectById(projectId: string, query?: Record<string, string | number | boolean | undefined>): Promise<Project & { client: Client; invoices: Invoice[] }> {
  return http(withQuery(`/api/admin/projects/${projectId}`, query));
}
export async function updateAdminProject(projectId: string, input: Partial<Omit<Project, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Project> {
  return http(`/api/admin/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function createAdminProjectComplete(projectId: string, input: Record<string, unknown>): Promise<Project> {
  return http(`/api/admin/projects/${projectId}/complete`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAdminProjectCancel(projectId: string, input: Record<string, unknown>): Promise<Project> {
  return http(`/api/admin/projects/${projectId}/cancel`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getMyInvoices(query?: Record<string, string | number | boolean | undefined>): Promise<Invoice[]> {
  return http(withQuery(`/api/my/invoices`, query));
}
export async function createMyInvoice(input: Partial<Omit<Invoice, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Invoice> {
  return http(`/api/my/invoices`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getMyInvoiceById(invoiceId: string, query?: Record<string, string | number | boolean | undefined>): Promise<Invoice & { line_items: InvoiceLineItem[]; payments: Payment[] }> {
  return http(withQuery(`/api/my/invoices/${invoiceId}`, query));
}
export async function updateMyInvoice(invoiceId: string, input: Partial<Omit<Invoice, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Invoice> {
  return http(`/api/my/invoices/${invoiceId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteMyInvoice(invoiceId: string): Promise<void> {
  return http(`/api/my/invoices/${invoiceId}`, { method: 'DELETE' });
}
export async function createMyInvoiceSend(invoiceId: string, input: Record<string, unknown>): Promise<Invoice> {
  return http(`/api/my/invoices/${invoiceId}/send`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createMyInvoiceLineItem(invoiceId: string, input: InvoiceLineItem): Promise<InvoiceLineItem> {
  return http(`/api/my/invoices/${invoiceId}/line-items`, { method: 'POST', body: JSON.stringify(input) });
}
export async function updateMyInvoiceLineItem(invoiceId: string, lineItemId: string, input: Partial<InvoiceLineItem>): Promise<InvoiceLineItem> {
  return http(`/api/my/invoices/${invoiceId}/line-items/${lineItemId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteMyInvoiceLineItem(invoiceId: string, lineItemId: string): Promise<any> {
  return http(`/api/my/invoices/${invoiceId}/line-items/${lineItemId}`, { method: 'DELETE' });
}
export async function getAdminInvoices(query?: Record<string, string | number | boolean | undefined>): Promise<Invoice[]> {
  return http(withQuery(`/api/admin/invoices`, query));
}
export async function createAdminInvoice(input: Partial<Omit<Invoice, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Invoice> {
  return http(`/api/admin/invoices`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getAdminInvoiceById(invoiceId: string, query?: Record<string, string | number | boolean | undefined>): Promise<Invoice & { line_items: InvoiceLineItem[]; payments: Payment[] }> {
  return http(withQuery(`/api/admin/invoices/${invoiceId}`, query));
}
export async function updateAdminInvoice(invoiceId: string, input: Partial<Omit<Invoice, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Invoice> {
  return http(`/api/admin/invoices/${invoiceId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteAdminInvoice(invoiceId: string): Promise<void> {
  return http(`/api/admin/invoices/${invoiceId}`, { method: 'DELETE' });
}
export async function createAdminInvoiceSend(invoiceId: string, input: Record<string, unknown>): Promise<Invoice> {
  return http(`/api/admin/invoices/${invoiceId}/send`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAdminInvoiceLineItem(invoiceId: string, input: InvoiceLineItem): Promise<InvoiceLineItem> {
  return http(`/api/admin/invoices/${invoiceId}/line-items`, { method: 'POST', body: JSON.stringify(input) });
}
export async function updateAdminInvoiceLineItem(invoiceId: string, lineItemId: string, input: Partial<InvoiceLineItem>): Promise<InvoiceLineItem> {
  return http(`/api/admin/invoices/${invoiceId}/line-items/${lineItemId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteAdminInvoiceLineItem(invoiceId: string, lineItemId: string): Promise<any> {
  return http(`/api/admin/invoices/${invoiceId}/line-items/${lineItemId}`, { method: 'DELETE' });
}
export async function getInvoicePayments(invoiceId: string, query?: Record<string, string | number | boolean | undefined>): Promise<Payment[]> {
  return http(withQuery(`/api/invoices/${invoiceId}/payments`, query));
}
export async function createInvoicePayment(invoiceId: string, input: Partial<Omit<Payment, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Payment> {
  return http(`/api/invoices/${invoiceId}/payments`, { method: 'POST', body: JSON.stringify(input) });
}
export async function updatePayment(paymentId: string, input: Partial<Omit<Payment, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Payment> {
  return http(`/api/payments/${paymentId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function createPaymentReceive(paymentId: string, input: { received_at?: string }): Promise<Payment> {
  return http(`/api/payments/${paymentId}/receive`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getMyOutstandingPayments(query?: Record<string, string | number | boolean | undefined>): Promise<Array<{ invoice_id: string; invoice_number: string; client_id: string; client_name: string; balance_due: number; due_date: string; days_overdue: number; status: string }>> {
  return http(withQuery(`/api/my/outstanding-payments`, query));
}
export async function getAdminOutstandingPayments(query?: Record<string, string | number | boolean | undefined>): Promise<Array<{ invoice_id: string; invoice_number: string; client_id: string; client_name: string; balance_due: number; due_date: string; days_overdue: number; status: string }>> {
  return http(withQuery(`/api/admin/outstanding-payments`, query));
}
export async function getMyReminders(query?: Record<string, string | number | boolean | undefined>): Promise<Reminder[]> {
  return http(withQuery(`/api/my/reminders`, query));
}
export async function getAdminReminders(query?: Record<string, string | number | boolean | undefined>): Promise<Reminder[]> {
  return http(withQuery(`/api/admin/reminders`, query));
}
export async function createInvoiceReminder(invoiceId: string, input: Partial<Omit<Reminder, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Reminder> {
  return http(`/api/invoices/${invoiceId}/reminders`, { method: 'POST', body: JSON.stringify(input) });
}
export async function updateMyReminder(reminderId: string, input: Partial<Omit<Reminder, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Reminder> {
  return http(`/api/my/reminders/${reminderId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function updateAdminReminder(reminderId: string, input: Partial<Omit<Reminder, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Reminder> {
  return http(`/api/admin/reminders/${reminderId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function createMyReminderApprove(reminderId: string, input: Record<string, unknown>): Promise<Reminder> {
  return http(`/api/my/reminders/${reminderId}/approve`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAdminReminderApprove(reminderId: string, input: Record<string, unknown>): Promise<Reminder> {
  return http(`/api/admin/reminders/${reminderId}/approve`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createMyReminderSend(reminderId: string, input: Record<string, unknown>): Promise<Reminder> {
  return http(`/api/my/reminders/${reminderId}/send`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAdminReminderSend(reminderId: string, input: Record<string, unknown>): Promise<Reminder> {
  return http(`/api/admin/reminders/${reminderId}/send`, { method: 'POST', body: JSON.stringify(input) });
}
export async function deleteMyReminder(reminderId: string): Promise<void> {
  return http(`/api/my/reminders/${reminderId}`, { method: 'DELETE' });
}
export async function deleteAdminReminder(reminderId: string): Promise<void> {
  return http(`/api/admin/reminders/${reminderId}`, { method: 'DELETE' });
}
export async function getMyExpenses(query?: Record<string, string | number | boolean | undefined>): Promise<Expens[]> {
  return http(withQuery(`/api/my/expenses`, query));
}
export async function getAdminExpenses(query?: Record<string, string | number | boolean | undefined>): Promise<Expens[]> {
  return http(withQuery(`/api/admin/expenses`, query));
}
export async function createExpens(input: Partial<Omit<Expens, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Expens> {
  return http(`/api/expenses`, { method: 'POST', body: JSON.stringify(input) });
}
export async function updateMyExpens(expenseId: string, input: Partial<Omit<Expens, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Expens> {
  return http(`/api/my/expenses/${expenseId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function updateAdminExpens(expenseId: string, input: Partial<Omit<Expens, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Expens> {
  return http(`/api/admin/expenses/${expenseId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteMyExpens(expenseId: string): Promise<void> {
  return http(`/api/my/expenses/${expenseId}`, { method: 'DELETE' });
}
export async function deleteAdminExpens(expenseId: string): Promise<void> {
  return http(`/api/admin/expenses/${expenseId}`, { method: 'DELETE' });
}
export async function getMyRecurringBills(query?: Record<string, string | number | boolean | undefined>): Promise<RecurringBill[]> {
  return http(withQuery(`/api/my/recurring-bills`, query));
}
export async function getAdminRecurringBills(query?: Record<string, string | number | boolean | undefined>): Promise<RecurringBill[]> {
  return http(withQuery(`/api/admin/recurring-bills`, query));
}
export async function createRecurringBill(input: Partial<Omit<RecurringBill, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<RecurringBill> {
  return http(`/api/recurring-bills`, { method: 'POST', body: JSON.stringify(input) });
}
export async function updateMyRecurringBill(recurringBillId: string, input: Partial<Omit<RecurringBill, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<RecurringBill> {
  return http(`/api/my/recurring-bills/${recurringBillId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function updateAdminRecurringBill(recurringBillId: string, input: Partial<Omit<RecurringBill, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<RecurringBill> {
  return http(`/api/admin/recurring-bills/${recurringBillId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function createMyRecurringBillMarkPaid(recurringBillId: string, input: Record<string, unknown>): Promise<RecurringBill> {
  return http(`/api/my/recurring-bills/${recurringBillId}/mark-paid`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAdminRecurringBillMarkPaid(recurringBillId: string, input: Record<string, unknown>): Promise<RecurringBill> {
  return http(`/api/admin/recurring-bills/${recurringBillId}/mark-paid`, { method: 'POST', body: JSON.stringify(input) });
}
export async function deleteMyRecurringBill(recurringBillId: string): Promise<void> {
  return http(`/api/my/recurring-bills/${recurringBillId}`, { method: 'DELETE' });
}
export async function deleteAdminRecurringBill(recurringBillId: string): Promise<void> {
  return http(`/api/admin/recurring-bills/${recurringBillId}`, { method: 'DELETE' });
}
export async function getAdminGoals(query?: Record<string, string | number | boolean | undefined>): Promise<Array<{ goal: Goal; completed_count: number; progress_percent: number }>> {
  return http(withQuery(`/api/admin/goals`, query));
}
export async function createAdminGoal(input: Partial<Omit<Goal, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Goal> {
  return http(`/api/admin/goals`, { method: 'POST', body: JSON.stringify(input) });
}
export async function updateAdminGoal(goalId: string, input: Partial<Omit<Goal, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Goal> {
  return http(`/api/admin/goals/${goalId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteAdminGoal(goalId: string): Promise<void> {
  return http(`/api/admin/goals/${goalId}`, { method: 'DELETE' });
}
export async function getAdminWorkloadSummary(query?: { week_start?: string; weeks?: number }): Promise<Array<{ week_start: string; workload_percent: number; capacity_hours: number; open_task_count: number; active_project_count: number }>> {
  return http(withQuery(`/api/admin/workload-summary`, query));
}
export async function getMyCalendar(query?: { from?: string; to?: string }): Promise<Array<{ kind: string; id: string; title: string; date: string; status: string }>> {
  return http(withQuery(`/api/my/calendar`, query));
}
export async function getAdminCalendar(query?: { from?: string; to?: string }): Promise<Array<{ kind: string; id: string; title: string; date: string; status: string }>> {
  return http(withQuery(`/api/admin/calendar`, query));
}
export async function createTask(input: Partial<Omit<Task, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Task> {
  return http(`/api/tasks`, { method: 'POST', body: JSON.stringify(input) });
}
export async function updateMyTask(taskId: string, input: Partial<Omit<Task, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Task> {
  return http(`/api/my/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function updateAdminTask(taskId: string, input: Partial<Omit<Task, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Task> {
  return http(`/api/admin/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function createMyTaskComplete(taskId: string, input: Record<string, unknown>): Promise<Task> {
  return http(`/api/my/tasks/${taskId}/complete`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAdminTaskComplete(taskId: string, input: Record<string, unknown>): Promise<Task> {
  return http(`/api/admin/tasks/${taskId}/complete`, { method: 'POST', body: JSON.stringify(input) });
}
export async function deleteMyTask(taskId: string): Promise<void> {
  return http(`/api/my/tasks/${taskId}`, { method: 'DELETE' });
}
export async function deleteAdminTask(taskId: string): Promise<void> {
  return http(`/api/admin/tasks/${taskId}`, { method: 'DELETE' });
}
export async function getMyWeeklyBusinessReview(query?: { week_start?: string }): Promise<{ week_start: string; completed_projects: Project[]; payments_collected: number; expenses_total: number; overdue_invoices: number; goal_progress: number[]; priorities: Task[] }> {
  return http(withQuery(`/api/my/weekly-business-review`, query));
}
export async function getAdminWeeklyBusinessReview(query?: { week_start?: string }): Promise<{ week_start: string; completed_projects: Project[]; payments_collected: number; expenses_total: number; overdue_invoices: number; goal_progress: number[]; priorities: Task[] }> {
  return http(withQuery(`/api/admin/weekly-business-review`, query));
}
export async function createMyWeeklyBusinessReviewPriority(input: { week_start: string }): Promise<Task[]> {
  return http(`/api/my/weekly-business-review/priorities`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAdminWeeklyBusinessReviewPriority(input: { week_start: string }): Promise<Task[]> {
  return http(`/api/admin/weekly-business-review/priorities`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getMyInsights(query?: Record<string, string | number | boolean | undefined>): Promise<Insight[]> {
  return http(withQuery(`/api/my/insights`, query));
}
export async function createMyInsightGenerate(input: Record<string, unknown>): Promise<{ generated: number; insights: Insight[] }> {
  return http(`/api/my/insights/generate`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createMyInsightDismiss(insightId: string, input: Record<string, unknown>): Promise<Insight> {
  return http(`/api/my/insights/${insightId}/dismiss`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createMyInsightComplete(insightId: string, input: Record<string, unknown>): Promise<Insight> {
  return http(`/api/my/insights/${insightId}/complete`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getAdminInsights(query?: Record<string, string | number | boolean | undefined>): Promise<Insight[]> {
  return http(withQuery(`/api/admin/insights`, query));
}
export async function createAdminInsightGenerate(input: Record<string, unknown>): Promise<{ generated: number; insights: Insight[] }> {
  return http(`/api/admin/insights/generate`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAdminInsightDismiss(insightId: string, input: Record<string, unknown>): Promise<Insight> {
  return http(`/api/admin/insights/${insightId}/dismiss`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAdminInsightComplete(insightId: string, input: Record<string, unknown>): Promise<Insight> {
  return http(`/api/admin/insights/${insightId}/complete`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getMyCashflowForecasts(query?: Record<string, string | number | boolean | undefined>): Promise<CashflowForecast[]> {
  return http(withQuery(`/api/my/cashflow-forecasts`, query));
}
export async function createMyCashflowForecast(input: Partial<Omit<CashflowForecast, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<CashflowForecast[]> {
  return http(`/api/my/cashflow-forecasts`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getAdminCashflowForecasts(query?: Record<string, string | number | boolean | undefined>): Promise<CashflowForecast[]> {
  return http(withQuery(`/api/admin/cashflow-forecasts`, query));
}
export async function createAdminCashflowForecast(input: Partial<Omit<CashflowForecast, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<CashflowForecast[]> {
  return http(`/api/admin/cashflow-forecasts`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getAdminSimulations(query?: Record<string, string | number | boolean | undefined>): Promise<Simulation[]> {
  return http(withQuery(`/api/admin/simulations`, query));
}
export async function createAdminSimulation(input: Partial<Omit<Simulation, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Simulation> {
  return http(`/api/admin/simulations`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getAdminSimulationById(simulationId: string, query?: Record<string, string | number | boolean | undefined>): Promise<{ simulation: Simulation; horizons: Array<{ horizon_days: number; baseline_inflow: number; projected_inflow: number; projected_balance: number; shortfall_amount: number }> }> {
  return http(withQuery(`/api/admin/simulations/${simulationId}`, query));
}
export async function updateAdminSimulation(simulationId: string, input: Partial<Omit<Simulation, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Simulation> {
  return http(`/api/admin/simulations/${simulationId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteAdminSimulation(simulationId: string): Promise<void> {
  return http(`/api/admin/simulations/${simulationId}`, { method: 'DELETE' });
}
export async function createAdminSimulationComplete(simulationId: string, input: Record<string, unknown>): Promise<{ simulation: Simulation; horizons: Array<{ horizon_days: number; baseline_inflow: number; projected_inflow: number; projected_balance: number; shortfall_amount: number }> }> {
  return http(`/api/admin/simulations/${simulationId}/complete`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getMyHealthScores(query?: Record<string, string | number | boolean | undefined>): Promise<HealthScore & { drags: Array<{ area: string; score: number; reason: string }> }> {
  return http(withQuery(`/api/my/health-scores`, query));
}
export async function createMyHealthScore(input: Partial<Omit<HealthScore, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<HealthScore & { drags: Array<{ area: string; score: number; reason: string }> }> {
  return http(`/api/my/health-scores`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getAdminHealthScores(query?: Record<string, string | number | boolean | undefined>): Promise<HealthScore & { drags: Array<{ area: string; score: number; reason: string }> }> {
  return http(withQuery(`/api/admin/health-scores`, query));
}
export async function createAdminHealthScore(input: Partial<Omit<HealthScore, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<HealthScore & { drags: Array<{ area: string; score: number; reason: string }> }> {
  return http(`/api/admin/health-scores`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getMyQuotes(query?: Record<string, string | number | boolean | undefined>): Promise<Quote[]> {
  return http(withQuery(`/api/my/quotes`, query));
}
export async function createMyQuoteGenerate(input: Record<string, unknown>): Promise<Quote> {
  return http(`/api/my/quotes/generate`, { method: 'POST', body: JSON.stringify(input) });
}
export async function updateMyQuote(quoteId: string, input: Partial<Omit<Quote, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Quote> {
  return http(`/api/my/quotes/${quoteId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function createMyQuoteAcceptChallenge(quoteId: string, input: Record<string, unknown>): Promise<Task> {
  return http(`/api/my/quotes/${quoteId}/accept-challenge`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAdminUserDeactivate(userId: string, input: Record<string, unknown>): Promise<{ id: string; email: string; name: string; role: string; is_active: boolean }> {
  return http(`/api/admin/users/${userId}/deactivate`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAdminUserReactivate(userId: string, input: Record<string, unknown>): Promise<{ id: string; email: string; name: string; role: string; is_active: boolean }> {
  return http(`/api/admin/users/${userId}/reactivate`, { method: 'POST', body: JSON.stringify(input) });
}
export async function deleteMyClient(clientId: string): Promise<void> {
  return http(`/api/my/clients/${clientId}`, { method: 'DELETE' });
}
export async function deleteAdminClient(clientId: string): Promise<void> {
  return http(`/api/admin/clients/${clientId}`, { method: 'DELETE' });
}
export async function createMyProjectStart(projectId: string, input: Record<string, unknown>): Promise<Project> {
  return http(`/api/my/projects/${projectId}/start`, { method: 'POST', body: JSON.stringify(input) });
}
export async function deleteMyProject(projectId: string): Promise<void> {
  return http(`/api/my/projects/${projectId}`, { method: 'DELETE' });
}
export async function createAdminProjectStart(projectId: string, input: Record<string, unknown>): Promise<Project> {
  return http(`/api/admin/projects/${projectId}/start`, { method: 'POST', body: JSON.stringify(input) });
}
export async function deleteAdminProject(projectId: string): Promise<void> {
  return http(`/api/admin/projects/${projectId}`, { method: 'DELETE' });
}
export async function getPaymentById(paymentId: string, query?: Record<string, string | number | boolean | undefined>): Promise<Payment> {
  return http(withQuery(`/api/payments/${paymentId}`, query));
}
export async function getReminderById(reminderId: string, query?: Record<string, string | number | boolean | undefined>): Promise<Reminder> {
  return http(withQuery(`/api/reminders/${reminderId}`, query));
}
export async function updateReminder(reminderId: string, input: Partial<Omit<Reminder, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Reminder> {
  return http(`/api/reminders/${reminderId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteReminder(reminderId: string): Promise<void> {
  return http(`/api/reminders/${reminderId}`, { method: 'DELETE' });
}
export async function createReminderApprove(reminderId: string, input: Record<string, unknown>): Promise<Reminder> {
  return http(`/api/reminders/${reminderId}/approve`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createReminderSend(reminderId: string, input: Record<string, unknown>): Promise<Reminder> {
  return http(`/api/reminders/${reminderId}/send`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getExpensById(expenseId: string, query?: Record<string, string | number | boolean | undefined>): Promise<Expens> {
  return http(withQuery(`/api/expenses/${expenseId}`, query));
}
export async function updateExpens(expenseId: string, input: Partial<Omit<Expens, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Expens> {
  return http(`/api/expenses/${expenseId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteExpens(expenseId: string): Promise<void> {
  return http(`/api/expenses/${expenseId}`, { method: 'DELETE' });
}
export async function getRecurringBillById(recurringBillId: string, query?: Record<string, string | number | boolean | undefined>): Promise<RecurringBill> {
  return http(withQuery(`/api/recurring-bills/${recurringBillId}`, query));
}
export async function updateRecurringBill(recurringBillId: string, input: Partial<Omit<RecurringBill, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<RecurringBill> {
  return http(`/api/recurring-bills/${recurringBillId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteRecurringBill(recurringBillId: string): Promise<void> {
  return http(`/api/recurring-bills/${recurringBillId}`, { method: 'DELETE' });
}
export async function createRecurringBillPause(recurringBillId: string, input: Record<string, unknown>): Promise<RecurringBill> {
  return http(`/api/recurring-bills/${recurringBillId}/pause`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createRecurringBillResume(recurringBillId: string, input: Record<string, unknown>): Promise<RecurringBill> {
  return http(`/api/recurring-bills/${recurringBillId}/resume`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createRecurringBillMarkPaid(recurringBillId: string, input: Record<string, unknown>): Promise<RecurringBill> {
  return http(`/api/recurring-bills/${recurringBillId}/mark-paid`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getMyGoals(query?: Record<string, string | number | boolean | undefined>): Promise<Goal[]> {
  return http(withQuery(`/api/my/goals`, query));
}
export async function createGoal(input: Partial<Omit<Goal, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Goal> {
  return http(`/api/goals`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getGoalById(goalId: string, query?: Record<string, string | number | boolean | undefined>): Promise<Goal> {
  return http(withQuery(`/api/goals/${goalId}`, query));
}
export async function updateGoal(goalId: string, input: Partial<Omit<Goal, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Goal> {
  return http(`/api/goals/${goalId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteGoal(goalId: string): Promise<void> {
  return http(`/api/goals/${goalId}`, { method: 'DELETE' });
}
export async function getAdminGoalWorkload(query?: Record<string, string | number | boolean | undefined>): Promise<Array<{ assignee_id: string; open_tasks: number; active_projects: number; load_percent: number }>> {
  return http(withQuery(`/api/admin/goals/workload`, query));
}
export async function getMyTasks(query?: Record<string, string | number | boolean | undefined>): Promise<Task[]> {
  return http(withQuery(`/api/my/tasks`, query));
}
export async function getAdminTasks(query?: Record<string, string | number | boolean | undefined>): Promise<Task[]> {
  return http(withQuery(`/api/admin/tasks`, query));
}
export async function getTaskById(taskId: string, query?: Record<string, string | number | boolean | undefined>): Promise<Task> {
  return http(withQuery(`/api/tasks/${taskId}`, query));
}
export async function updateTask(taskId: string, input: Partial<Omit<Task, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Task> {
  return http(`/api/tasks/${taskId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteTask(taskId: string): Promise<void> {
  return http(`/api/tasks/${taskId}`, { method: 'DELETE' });
}
export async function createTaskComplete(taskId: string, input: Record<string, unknown>): Promise<Task> {
  return http(`/api/tasks/${taskId}/complete`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createTaskPlanWeek(taskId: string, input: { week_start: string }): Promise<Task> {
  return http(`/api/tasks/${taskId}/plan-week`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAdminSimulationRun(simulationId: string, input: Record<string, unknown>): Promise<{ simulation: Simulation; baseline_balance: number; projected_balance: number; shortfall_amount: number }> {
  return http(`/api/admin/simulations/${simulationId}/run`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getMyHealthScoreLatest(query?: Record<string, string | number | boolean | undefined>): Promise<HealthScore & { drivers: Array<{ area: string; score: number; pulled_down_by: string }> }> {
  return http(withQuery(`/api/my/health-scores/latest`, query));
}
export async function getAdminHealthScoreLatest(query?: Record<string, string | number | boolean | undefined>): Promise<HealthScore & { drivers: Array<{ area: string; score: number; pulled_down_by: string }> }> {
  return http(withQuery(`/api/admin/health-scores/latest`, query));
}
export async function createMyQuoteToday(input: Record<string, unknown>): Promise<Quote> {
  return http(`/api/my/quotes/today`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createMyQuoteSkipChallenge(quoteId: string, input: Record<string, unknown>): Promise<any> {
  return http(`/api/my/quotes/${quoteId}/skip-challenge`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createClient(input: Partial<Omit<Client, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Client> {
  return http(`/api/clients`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createProject(input: Partial<Omit<Project, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Project> {
  return http(`/api/projects`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createInvoice(input: Partial<Omit<Invoice, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Invoice> {
  return http(`/api/invoices`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createReminder(input: Partial<Omit<Reminder, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Reminder> {
  return http(`/api/reminders`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createRecurringBillEnd(recurringBillId: string, input: Record<string, unknown>): Promise<RecurringBill> {
  return http(`/api/recurring-bills/${recurringBillId}/end`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getGoals(query?: Record<string, string | number | boolean | undefined>): Promise<Array<{ goal: Goal; completion_rate: number }>> {
  return http(withQuery(`/api/goals`, query));
}
export async function getGoalWorkload(query?: Record<string, string | number | boolean | undefined>): Promise<{ period_start: string; period_end: string; active_projects: number; target_project_count: number; completed_count: number; capacity_hours_per_week: number; load_ratio: number }> {
  return http(withQuery(`/api/goals/workload`, query));
}
export async function getMyNextActions(query?: Record<string, string | number | boolean | undefined>): Promise<Insight[]> {
  return http(withQuery(`/api/my/next-actions`, query));
}
export async function getSimulations(query?: Record<string, string | number | boolean | undefined>): Promise<Simulation[]> {
  return http(withQuery(`/api/simulations`, query));
}
export async function createSimulation(input: Partial<Omit<Simulation, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Simulation> {
  return http(`/api/simulations`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getSimulationById(simulationId: string, query?: Record<string, string | number | boolean | undefined>): Promise<Simulation> {
  return http(withQuery(`/api/simulations/${simulationId}`, query));
}
export async function updateSimulation(simulationId: string, input: Partial<Omit<Simulation, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Simulation> {
  return http(`/api/simulations/${simulationId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteSimulation(simulationId: string): Promise<void> {
  return http(`/api/simulations/${simulationId}`, { method: 'DELETE' });
}
export async function createSimulationRun(simulationId: string, input: Record<string, unknown>): Promise<{ simulation: Simulation; projected_payment_date: string; baseline_balance: number; projected_balance: number; shortfall_amount: number }> {
  return http(`/api/simulations/${simulationId}/run`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getMyQuoteToday(query?: Record<string, string | number | boolean | undefined>): Promise<Quote> {
  return http(withQuery(`/api/my/quotes/today`, query));
}
export async function deleteMyQuote(quoteId: string): Promise<void> {
  return http(`/api/my/quotes/${quoteId}`, { method: 'DELETE' });
}
export async function getInvoiceLineItems(invoiceId: string, query?: Record<string, string | number | boolean | undefined>): Promise<InvoiceLineItem[]> {
  return http(withQuery(`/api/invoices/${invoiceId}/line-items`, query));
}
export async function createInvoiceLineItem(invoiceId: string, input: InvoiceLineItem): Promise<InvoiceLineItem> {
  return http(`/api/invoices/${invoiceId}/line-items`, { method: 'POST', body: JSON.stringify(input) });
}
export async function updateLineItem(lineItemId: string, input: Partial<InvoiceLineItem>): Promise<InvoiceLineItem> {
  return http(`/api/line-items/${lineItemId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteLineItem(lineItemId: string): Promise<any> {
  return http(`/api/line-items/${lineItemId}`, { method: 'DELETE' });
}
export async function getClientById(clientId: string, query?: Record<string, string | number | boolean | undefined>): Promise<{ client: Client; projects: Project[]; invoices: Invoice[]; payments: Payment[] }> {
  return http(withQuery(`/api/clients/${clientId}`, query));
}
export async function updateClient(clientId: string, input: Partial<Omit<Client, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Client> {
  return http(`/api/clients/${clientId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteClient(clientId: string): Promise<void> {
  return http(`/api/clients/${clientId}`, { method: 'DELETE' });
}
export async function getProjectById(projectId: string, query?: Record<string, string | number | boolean | undefined>): Promise<{ project: Project; client: Client; tasks: Task[]; invoices: Invoice[] }> {
  return http(withQuery(`/api/projects/${projectId}`, query));
}
export async function updateProject(projectId: string, input: Partial<Omit<Project, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Project> {
  return http(`/api/projects/${projectId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteProject(projectId: string): Promise<void> {
  return http(`/api/projects/${projectId}`, { method: 'DELETE' });
}
export async function getInvoiceById(invoiceId: string, query?: Record<string, string | number | boolean | undefined>): Promise<{ invoice: Invoice; line_items: InvoiceLineItem[]; payments: Payment[]; client: Client; project: Project }> {
  return http(withQuery(`/api/invoices/${invoiceId}`, query));
}
export async function updateInvoice(invoiceId: string, input: Partial<Omit<Invoice, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Invoice> {
  return http(`/api/invoices/${invoiceId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteInvoice(invoiceId: string): Promise<void> {
  return http(`/api/invoices/${invoiceId}`, { method: 'DELETE' });
}
export async function createInvoiceSend(invoiceId: string, input: Record<string, unknown>): Promise<Invoice> {
  return http(`/api/invoices/${invoiceId}/send`, { method: 'POST', body: JSON.stringify(input) });
}
export async function updateInvoiceLineItem(invoiceId: string, lineItemId: string, input: Partial<InvoiceLineItem>): Promise<{ line_item: InvoiceLineItem; invoice: Invoice }> {
  return http(`/api/invoices/${invoiceId}/line-items/${lineItemId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function deleteInvoiceLineItem(invoiceId: string, lineItemId: string): Promise<any> {
  return http(`/api/invoices/${invoiceId}/line-items/${lineItemId}`, { method: 'DELETE' });
}
export async function getWorkload(query?: Record<string, string | number | boolean | undefined>): Promise<Array<{ assignee_id: string; open_task_count: number; project_deadline_count: number; workload_percent: number }>> {
  return http(withQuery(`/api/workload`, query));
}
export async function getMyTasksCalendar(query?: { from?: string; to?: string }): Promise<Array<{ date: string; kind: string; title: string; id: string }>> {
  return http(withQuery(`/api/my/tasks-calendar`, query));
}
export async function getAdminTasksCalendar(query?: { from?: string; to?: string }): Promise<Array<{ date: string; kind: string; title: string; id: string; assignee_id: string }>> {
  return http(withQuery(`/api/admin/tasks-calendar`, query));
}
export async function createMyCashflowForecastGenerate(input: Record<string, unknown>): Promise<CashflowForecast[]> {
  return http(`/api/my/cashflow-forecasts/generate`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAdminCashflowForecastGenerate(input: Record<string, unknown>): Promise<CashflowForecast[]> {
  return http(`/api/admin/cashflow-forecasts/generate`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createMyHealthScoreRecalculate(input: Record<string, unknown>): Promise<{ overall_score: number; project_consistency_score: number; payment_collection_score: number; cashflow_stability_score: number; workload_score: number; expense_management_score: number; generated_at: string; drivers: { project_consistency: string; payment_collection: string; cashflow_stability: string; workload: string; expense_management: string } }> {
  return http(`/api/my/health-scores/recalculate`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAdminHealthScoreRecalculate(input: Record<string, unknown>): Promise<{ overall_score: number; project_consistency_score: number; payment_collection_score: number; cashflow_stability_score: number; workload_score: number; expense_management_score: number; generated_at: string; drivers: { project_consistency: string; payment_collection: string; cashflow_stability: string; workload: string; expense_management: string } }> {
  return http(`/api/admin/health-scores/recalculate`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getAdminNextActions(query?: Record<string, string | number | boolean | undefined>): Promise<any> {
  return http(withQuery(`/api/admin/next-actions`, query));
}
export async function getMyPayments(query?: Record<string, string | number | boolean | undefined>): Promise<Payment[]> {
  return http(withQuery(`/api/my/payments`, query));
}
export async function getAdminPayments(query?: Record<string, string | number | boolean | undefined>): Promise<Payment[]> {
  return http(withQuery(`/api/admin/payments`, query));
}
export async function getAdminQuoteToday(query?: Record<string, string | number | boolean | undefined>): Promise<any> {
  return http(withQuery(`/api/admin/quotes/today`, query));
}
export async function createAdminQuoteToday(input: Record<string, unknown>): Promise<any> {
  return http(`/api/admin/quotes/today`, { method: 'POST', body: JSON.stringify(input) });
}
export async function getAdminQuotes(query?: Record<string, string | number | boolean | undefined>): Promise<Quote[]> {
  return http(withQuery(`/api/admin/quotes`, query));
}
export async function updateAdminQuote(quoteId: string, input: Partial<Omit<Quote, 'createdAt' | 'deletedAt' | 'id' | 'updatedAt'>>): Promise<Quote> {
  return http(`/api/admin/quotes/${quoteId}`, { method: 'PATCH', body: JSON.stringify(input) });
}
export async function createAdminQuoteAcceptChallenge(quoteId: string, input: Record<string, unknown>): Promise<any> {
  return http(`/api/admin/quotes/${quoteId}/accept-challenge`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createAdminQuoteSkipChallenge(quoteId: string, input: Record<string, unknown>): Promise<any> {
  return http(`/api/admin/quotes/${quoteId}/skip-challenge`, { method: 'POST', body: JSON.stringify(input) });
}
