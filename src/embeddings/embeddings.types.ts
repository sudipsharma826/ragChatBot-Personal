export interface SiteConfig {
  siteName: string;
  tagline?: string;
  description?: string;
  email?: string;
  phone?: string;
  address?: string;
  logoUrl?: string;
}

export interface PersonalData {
  fullName: string;
  title?: string;
  bio?: string;
  email?: string;
  phone?: string;
  location?: string;
  profileImageUrl?: string;
  resumeUrl?: string;
  cvUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  twitterUrl?: string;
  websiteUrl?: string;
  facebookUrl?: string;
  summary?: string;
  objective?: string;
  heroBio?: string;
  languages?: string;
  hobbies?: string;
  references?: string;
  currentLearning?: string;
}

export interface Experience {
  company: string;
  position?: string;
  location?: string;
  startDate?: string | null;
  endDate?: string | null;
  description?: string;
  achievements?: string | string[];
}

export interface Education {
  institution: string;
  degree?: string;
  field?: string;
  location?: string;
  startDate?: string | null;
  endDate?: string | null;
  grade?: string | null;
  description?: string;
  achievements?: string | string[];
}

export interface Skill {
  name: string;
  experienceYears: number;
}

export interface Project {
  title: string;
  description?: string;
  liveUrl?: string;
  githubUrl?: string;
  featured?: boolean;
  features?: string[];
  skills?: string[];
}

export interface Certificate {
  title: string;
  instituteName?: string;
  issueDate?: string;
  imageUrl?: string;
  credentialUrl?: string;
  description?: string;
  featured?: boolean;
  skills?: string[];
}

export interface ProfileData {
  siteConfig?: SiteConfig;
  personalData?: PersonalData;
  experiences?: Experience[];
  educations?: Education[];
  skills?: Skill[];
  projects?: Project[];
  certificates?: Certificate[];
}