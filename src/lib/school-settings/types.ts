export type SchoolSettingsRow = {
  id: string;
  schoolName: string;
  logoStoragePath: string | null;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
  website: string;
  primaryColor: string;
  secondaryColor: string;
  reportCardFooter: string;
  principalName: string;
  createdAt: string;
  updatedAt: string;
};

export type SchoolReportBranding = {
  schoolName: string;
  logoStoragePath: string | null;
  logoSignedUrl: string | null;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
  website: string;
  primaryColor: string;
  secondaryColor: string;
  reportCardFooter: string;
  principalName: string;
  isConfigured: boolean;
};
