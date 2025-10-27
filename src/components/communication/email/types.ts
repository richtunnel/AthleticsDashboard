export interface EmailGroupEmail {
  id: string;
  email: string;
}

export interface EmailGroup {
  id: string;
  name: string;
  userId: string;
  organizationId: string;
  createdAt: string;
  emails: EmailGroupEmail[];
  _count: {
    emails: number;
  };
}
