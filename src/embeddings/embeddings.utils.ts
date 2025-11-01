import { randomUUID } from 'crypto';

interface PersonalData {
  fullName: string;
  title: string;
  location: string;
  bio?: string;
  objective?: string;
  summary?: string;
  heroBio?: string;
  email?: string;
  phone?: string;
  websiteUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  facebookUrl?: string;
  languages?: string;
  hobbies?: string;
  currentLearning?: string;
}

interface Experience {
  company: string;
  position: string;
  location?: string;
  startDate: string;
  endDate?: string;
  description?: string;
  achievements?: string[] | string;
}

interface Education {
  institution: string;
  degree: string;
  field?: string;
  location?: string;
  startDate: string;
  endDate?: string;
  grade?: string;
  description?: string;
  achievements?: string[] | string;
}

interface Skill {
  name: string;
  experienceYears?: string;
}

interface Project {
  title: string;
  description?: string;
  features?: string[];
  skills?: string[];
  liveUrl?: string;
  githubUrl?: string;
  featured?: boolean;
}

interface Certificate {
  title: string;
  instituteName: string;
  issueDate: string;
  description?: string;
  credentialUrl?: string;
  featured?: boolean;
  skills?: string[];
}

interface ProfileData {
  personalData?: PersonalData;
  experiences?: Experience[];
  educations?: Education[];
  skills?: Skill[];
  projects?: Project[];
  certificates?: Certificate[];
}

interface ChunkMetadata {
  entityType: string;
  entityName: string;
  timeframe?: 'current' | 'past' | 'recent' | 'historical';
  importance: 'high' | 'medium' | 'low';
  skills?: string[];
}

interface TextChunk {
  id: string;
  type: string;
  title: string;
  text: string;
  metadata?: ChunkMetadata;
}

export function createTextChunks(profileData: ProfileData): TextChunk[] {
  const chunks: TextChunk[] = [];

  // --------- Personal Info (Single Cohesive Chunk) ---------
  if (profileData.personalData) {
    const p = profileData.personalData;
    const personalText = `
Professional Profile: ${p.fullName} is a ${p.title} based in ${p.location}.
${p.summary ? `Professional Summary: ${p.summary}` : ''}
${p.bio ? `Bio: ${p.bio}` : ''}
${p.objective ? `Career Objective: ${p.objective}` : ''}
${p.heroBio ? `Detailed Bio: ${p.heroBio}` : ''}
Contact Information: ${p.email || ''} ${p.phone ? `| Phone: ${p.phone}` : ''}
Online Presence: ${[p.websiteUrl, p.linkedinUrl, p.githubUrl, p.facebookUrl].filter(Boolean).join(' | ')}
Additional Information: ${p.languages ? `Languages: ${p.languages}` : ''} ${p.hobbies ? `| Hobbies: ${p.hobbies}` : ''} ${p.currentLearning ? `| Currently Learning: ${p.currentLearning}` : ''}
`.trim();

    if (personalText.length > 50) {
      chunks.push({
        id: randomUUID(),
        type: 'personal',
        title: `Professional Profile - ${p.fullName}`,
        text: personalText,
        metadata: {
          entityType: 'person',
          entityName: p.fullName,
          importance: 'high'
        }
      });
    }
  }

  // --------- Experiences (One Chunk Per Experience) ---------
  profileData.experiences?.forEach((exp: Experience, index: number) => {
    const isCurrent = !exp.endDate || exp.endDate.toLowerCase() === 'present';
    const timeframe = isCurrent ? 'current' : index === 0 ? 'recent' : 'past';
    
    const experienceText = `
Work Experience: ${exp.position} at ${exp.company}
${exp.location ? `Location: ${exp.location}` : ''}
Duration: ${exp.startDate} to ${exp.endDate || 'Present'}
${exp.description ? `Role Description: ${exp.description}` : ''}
${exp.achievements ? `Key Achievements: ${Array.isArray(exp.achievements) ? exp.achievements.join('; ') : exp.achievements}` : ''}
`.trim();

    chunks.push({
      id: randomUUID(),
      type: 'experience',
      title: `${isCurrent ? 'Current Role' : 'Previous Experience'} - ${exp.company}`,
      text: experienceText,
      metadata: {
        entityType: 'experience',
        entityName: exp.company,
        timeframe: timeframe as 'current' | 'past' | 'recent',
        importance: isCurrent ? 'high' : index === 0 ? 'medium' : 'low'
      }
    });
  });

  // --------- Education (One Chunk Per Education) ---------
  profileData.educations?.forEach((edu: Education, index: number) => {
    const isCurrent = !edu.endDate || edu.endDate.toLowerCase() === 'present';
    
    const educationText = `
Education: ${edu.degree} at ${edu.institution}
${edu.field ? `Field of Study: ${edu.field}` : ''}
${edu.location ? `Location: ${edu.location}` : ''}
Duration: ${edu.startDate} to ${edu.endDate || 'Present'}
${edu.grade ? `Grade: ${edu.grade}` : ''}
${edu.description ? `Description: ${edu.description}` : ''}
${edu.achievements ? `Achievements: ${Array.isArray(edu.achievements) ? edu.achievements.join('; ') : edu.achievements}` : ''}
`.trim();

    chunks.push({
      id: randomUUID(),
      type: 'education',
      title: `Education - ${edu.institution}`,
      text: educationText,
      metadata: {
        entityType: 'education',
        entityName: edu.institution,
        timeframe: isCurrent ? 'current' : 'past',
        importance: index === 0 ? 'medium' : 'low'
      }
    });
  });

  // --------- Skills (Group Related Skills) ---------
  if (profileData.skills && profileData.skills.length > 0) {
    const skillsText = `
Technical Skills and Proficiencies:
${profileData.skills.map(skill => 
  `- ${skill.name}${skill.experienceYears ? ` (${skill.experienceYears} years experience)` : ''}`
).join('\n')}
`.trim();

    chunks.push({
      id: randomUUID(),
      type: 'skills',
      title: 'Skills and Technologies',
      text: skillsText,
      metadata: {
        entityType: 'skills',
        entityName: 'Skills Overview',
        importance: 'high',
        skills: profileData.skills.map(s => s.name)
      }
    });
  }

  // --------- Projects (One Chunk Per Project) ---------
  profileData.projects?.forEach((proj: Project, index: number) => {
    const projectText = `
Project: ${proj.title}
${proj.description ? `Description: ${proj.description}` : ''}
${proj.features && proj.features.length > 0 ? `Key Features: ${proj.features.join(', ')}` : ''}
${proj.skills && proj.skills.length > 0 ? `Technologies Used: ${proj.skills.join(', ')}` : ''}
${proj.liveUrl ? `Live Demo: ${proj.liveUrl}` : ''}
${proj.githubUrl ? `Source Code: ${proj.githubUrl}` : ''}
${proj.featured ? 'Featured Project: Yes' : ''}
`.trim();

    chunks.push({
      id: randomUUID(),
      type: 'project',
      title: `Project - ${proj.title}`,
      text: projectText,
      metadata: {
        entityType: 'project',
        entityName: proj.title,
        importance: proj.featured ? 'medium' : 'low',
        skills: proj.skills || []
      }
    });
  });

  // --------- Certificates (One Chunk Per Certificate) ---------
  profileData.certificates?.forEach((cert: Certificate) => {
    const certificateText = `
Certification: ${cert.title}
Issuing Organization: ${cert.instituteName}
Issue Date: ${cert.issueDate}
${cert.description ? `Description: ${cert.description}` : ''}
${cert.credentialUrl ? `Credential URL: ${cert.credentialUrl}` : ''}
${cert.skills && cert.skills.length > 0 ? `Related Skills: ${cert.skills.join(', ')}` : ''}
${cert.featured ? 'Featured Certification: Yes' : ''}
`.trim();

    chunks.push({
      id: randomUUID(),
      type: 'certificate',
      title: `Certification - ${cert.title}`,
      text: certificateText,
      metadata: {
        entityType: 'certificate',
        entityName: cert.title,
        importance: cert.featured ? 'medium' : 'low',
        skills: cert.skills || []
      }
    });
  });

  return chunks;
}

export function createIntelligentChunks(profileData: ProfileData, maxChunkSize: number = 1000): TextChunk[] {
  const chunks: TextChunk[] = [];

  const splitLongText = (text: string, maxLength: number = maxChunkSize): string[] => {
    if (text.length <= maxLength) return [text];
    
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const chunks: string[] = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if ((currentChunk + ' ' + trimmedSentence).length > maxLength && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = trimmedSentence;
      } else {
        currentChunk += (currentChunk ? '. ' : '') + trimmedSentence;
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  };

  // --------- Personal Info ---------
  if (profileData.personalData) {
    const p = profileData.personalData;
    const personalChunks = splitLongText(`
${p.fullName} is a ${p.title} based in ${p.location}. 
${p.summary || p.bio || p.objective || ''}
Contact: ${p.email} ${p.phone ? `| ${p.phone}` : ''}
${p.linkedinUrl ? `LinkedIn: ${p.linkedinUrl}` : ''}
${p.githubUrl ? `GitHub: ${p.githubUrl}` : ''}
${p.languages ? `Languages: ${p.languages}` : ''}
${p.hobbies ? `Interests: ${p.hobbies}` : ''}
${p.currentLearning ? `Currently learning: ${p.currentLearning}` : ''}
`.trim());

    personalChunks.forEach((chunkText, index) => {
      chunks.push({
        id: randomUUID(),
        type: 'personal',
        title: index === 0 ? `Professional Profile - ${p.fullName}` : `${p.fullName} - Additional Details`,
        text: chunkText,
        metadata: {
          entityType: 'person',
          entityName: p.fullName,
          importance: 'high'
        }
      });
    });
  }

  // --------- Experiences ---------
  profileData.experiences?.forEach((exp: Experience, index: number) => {
    const isCurrent = !exp.endDate || exp.endDate.toLowerCase() === 'present';
    const timeframe = isCurrent ? 'current' : index === 0 ? 'recent' : 'past';
    
    const baseText = `${exp.position} at ${exp.company} from ${exp.startDate} to ${exp.endDate || 'Present'}. ${exp.location ? `Location: ${exp.location}.` : ''}`;
    const fullText = exp.description ? baseText + ' ' + exp.description : baseText;
    
    const experienceChunks = splitLongText(fullText);
    
    experienceChunks.forEach((chunkText, chunkIndex) => {
      const achievementsText = chunkIndex === experienceChunks.length - 1 && exp.achievements ? 
        ` Achievements: ${Array.isArray(exp.achievements) ? exp.achievements.join('; ') : exp.achievements}` : '';
      
      chunks.push({
        id: randomUUID(),
        type: 'experience',
        title: chunkIndex === 0 ? 
          `${isCurrent ? 'Current Role' : 'Work Experience'} - ${exp.company}` : 
          `${exp.company} - Additional Details`,
        text: chunkText + achievementsText,
        metadata: {
          entityType: 'experience',
          entityName: exp.company,
          timeframe: timeframe as any,
          importance: isCurrent ? 'high' : index === 0 ? 'medium' : 'low'
        }
      });
    });
  });

  // --------- Education ---------
  profileData.educations?.forEach((edu: Education, index: number) => {
    const isCurrent = !edu.endDate || edu.endDate.toLowerCase() === 'present';
    
    const baseText = `${edu.degree} at ${edu.institution} from ${edu.startDate} to ${edu.endDate || 'Present'}.`;
    const additionalInfo = [
      edu.field ? `Field: ${edu.field}` : '',
      edu.location ? `Location: ${edu.location}` : '',
      edu.grade ? `Grade: ${edu.grade}` : '',
      edu.description ? `Description: ${edu.description}` : ''
    ].filter(Boolean).join('. ');
    
    const fullText = baseText + (additionalInfo ? ' ' + additionalInfo : '');
    const educationChunks = splitLongText(fullText);
    
    educationChunks.forEach((chunkText, chunkIndex) => {
      const achievementsText = chunkIndex === educationChunks.length - 1 && edu.achievements ? 
        ` Achievements: ${Array.isArray(edu.achievements) ? edu.achievements.join('; ') : edu.achievements}` : '';
      
      chunks.push({
        id: randomUUID(),
        type: 'education',
        title: chunkIndex === 0 ? `Education - ${edu.institution}` : `${edu.institution} - Additional Details`,
        text: chunkText + achievementsText,
        metadata: {
          entityType: 'education',
          entityName: edu.institution,
          timeframe: isCurrent ? 'current' : 'past',
          importance: index === 0 ? 'medium' : 'low'
        }
      });
    });
  });

  // --------- Skills ---------
  if (profileData.skills && profileData.skills.length > 0) {
    const skillsByExperience = profileData.skills.reduce((acc, skill) => {
      const exp = skill.experienceYears || 'No experience specified';
      if (!acc[exp]) acc[exp] = [];
      acc[exp].push(skill.name);
      return acc;
    }, {} as Record<string, string[]>);

    let skillsText = 'Technical Skills and Proficiencies:\n';
    Object.entries(skillsByExperience).forEach(([exp, skills]) => {
      skillsText += `${exp}: ${skills.join(', ')}\n`;
    });

    const skillsChunks = splitLongText(skillsText.trim());
    
    skillsChunks.forEach((chunkText, index) => {
      chunks.push({
        id: randomUUID(),
        type: 'skills',
        title: index === 0 ? 'Skills and Technologies' : 'Additional Skills',
        text: chunkText,
        metadata: {
          entityType: 'skills',
          entityName: 'Skills Overview',
          importance: 'high',
          skills: profileData.skills!.map(s => s.name)
        }
      });
    });
  }

  // --------- Projects ---------
  profileData.projects?.forEach((proj: Project, index: number) => {
    const baseText = `Project: ${proj.title}. ${proj.description || ''}`;
    const additionalInfo = [
      proj.features && proj.features.length > 0 ? `Features: ${proj.features.join(', ')}` : '',
      proj.skills && proj.skills.length > 0 ? `Technologies: ${proj.skills.join(', ')}` : '',
      proj.liveUrl ? `Live Demo: ${proj.liveUrl}` : '',
      proj.githubUrl ? `Source Code: ${proj.githubUrl}` : ''
    ].filter(Boolean).join('. ');
    
    const fullText = baseText + (additionalInfo ? ' ' + additionalInfo : '');
    const projectChunks = splitLongText(fullText);
    
    projectChunks.forEach((chunkText, chunkIndex) => {
      chunks.push({
        id: randomUUID(),
        type: 'project',
        title: chunkIndex === 0 ? `Project - ${proj.title}` : `${proj.title} - Additional Details`,
        text: chunkText + (proj.featured ? ' (Featured Project)' : ''),
        metadata: {
          entityType: 'project',
          entityName: proj.title,
          importance: proj.featured ? 'medium' : 'low',
          skills: proj.skills || []
        }
      });
    });
  });

  // --------- Certificates ---------
  profileData.certificates?.forEach((cert: Certificate) => {
    const baseText = `Certification: ${cert.title} from ${cert.instituteName} issued on ${cert.issueDate}.`;
    const additionalInfo = [
      cert.description ? `Description: ${cert.description}` : '',
      cert.credentialUrl ? `Credential URL: ${cert.credentialUrl}` : '',
      cert.skills && cert.skills.length > 0 ? `Related Skills: ${cert.skills.join(', ')}` : ''
    ].filter(Boolean).join('. ');
    
    const fullText = baseText + (additionalInfo ? ' ' + additionalInfo : '');
    const certificateChunks = splitLongText(fullText);
    
    certificateChunks.forEach((chunkText, chunkIndex) => {
      chunks.push({
        id: randomUUID(),
        type: 'certificate',
        title: chunkIndex === 0 ? `Certification - ${cert.title}` : `${cert.title} - Additional Details`,
        text: chunkText + (cert.featured ? ' (Featured Certification)' : ''),
        metadata: {
          entityType: 'certificate',
          entityName: cert.title,
          importance: cert.featured ? 'medium' : 'low',
          skills: cert.skills || []
        }
      });
    });
  });

  return chunks;
}

// Utility function to test chunk quality
export function analyzeChunks(chunks: TextChunk[]): void {
  console.log(`Total chunks: ${chunks.length}`);
  
  const byType = chunks.reduce((acc, chunk) => {
    acc[chunk.type] = (acc[chunk.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('Chunks by type:', byType);
  
  chunks.forEach((chunk, index) => {
    console.log(`\n--- Chunk ${index + 1} (${chunk.type}) ---`);
    console.log(`Title: ${chunk.title}`);
    console.log(`Text length: ${chunk.text.length}`);
    console.log(`First 150 chars: ${chunk.text.substring(0, 150)}...`);
  });
}