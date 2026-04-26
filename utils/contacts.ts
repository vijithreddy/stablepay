// BEFORE NACHA DEMO:
// Replace placeholder addresses in seedDemoContacts()
// with real Base wallet addresses for Bob and Alice.
// Bob's address: YOUR SECOND DEVICE WALLET ADDRESS
// Alice's address: ANY OTHER REAL BASE ADDRESS
// Run the app fresh to seed them automatically.
// Or manually add via the "+ Add new contact" button.

import AsyncStorage from '@react-native-async-storage/async-storage';

const CONTACTS_KEY = 'stablepay_contacts';

export interface Contact {
  id: string;
  name: string;
  address: string;
  emoji: string;
  addedAt: number;
}

export async function getContacts(): Promise<Contact[]> {
  try {
    const raw = await AsyncStorage.getItem(CONTACTS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Contact[];
  } catch {
    return [];
  }
}

export async function saveContact(
  contact: Omit<Contact, 'id' | 'addedAt'>
): Promise<Contact> {
  const contacts = await getContacts();

  const exists = contacts.find(
    (c) => c.address.toLowerCase() === contact.address.toLowerCase()
  );
  if (exists) {
    throw new Error(
      `${contact.address.slice(0, 6)}... is already saved as "${exists.name}"`
    );
  }

  const newContact: Contact = {
    ...contact,
    id: Date.now().toString(),
    addedAt: Date.now(),
  };

  await AsyncStorage.setItem(
    CONTACTS_KEY,
    JSON.stringify([...contacts, newContact])
  );

  console.log('[StablePay] Contact saved:', {
    name: newContact.name,
    address: newContact.address.slice(0, 10) + '...',
  });

  return newContact;
}

export async function deleteContact(id: string): Promise<void> {
  const contacts = await getContacts();
  const updated = contacts.filter((c) => c.id !== id);
  await AsyncStorage.setItem(CONTACTS_KEY, JSON.stringify(updated));
}

export async function seedDemoContacts(): Promise<void> {
  const existing = await getContacts();
  if (existing.length > 0) return;

  const demos = [
    {
      name: 'Charlie',
      address: '0xea51dda8d548fef9f036ef842df69ecd8bd3eff4',
      emoji: 'C',
    },
    {
      name: 'Alice',
      address: '0xEA51ddA8D548fef9F036ef842DF69eCD8bd3Eff4',
      emoji: 'A',
    },
  ];

  for (const d of demos) {
    try {
      await saveContact(d);
    } catch {}
  }

  console.log('[StablePay] Demo contacts seeded');
}

export function truncateAddress(address: string): string {
  if (!address || address.length < 10) return address;
  return address.slice(0, 6) + '...' + address.slice(-4);
}

export function validateAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}
