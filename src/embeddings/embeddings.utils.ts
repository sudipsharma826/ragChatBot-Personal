import { randomUUID } from 'crypto';
import { 
  ProfileData, 
  PersonalData, 
  Experience, 
  Education, 
  Project, 
  Certificate, 
  Skill 
} from './embeddings.types';

export interface ChunkMetadata {
  entityType: string;
  entityName: string;
  timeframe?: 'current' | 'past' | 'recent' | 'historical';
  importance: 'high' | 'medium' | 'low';
  skills?: string[];
}

export interface TextChunk {
  id: string;
  type: string;
  title: string;
  text: string;
  metadata?: ChunkMetadata;
}

/**
 * Splits text into chunks with a specified overlap to preserve context.
 */
export function chunkTextWithOverlap(text: string, maxChars: number = 1500, overlapChars: number = 300): string[] {
  if (text.length <= maxChars) return [text];
  
  const sentences = text.split(/(?<=[.!?])\s+/).filter(s => s.trim().length > 0);
  const chunks: string[] = [];
  
  let currentChunk = '';
  let overlapBuffer = '';
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim();
    
    if ((currentChunk + ' ' + sentence).length > maxChars && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
      
      // Start new chunk with the overlap buffer
      currentChunk = overlapBuffer + (overlapBuffer ? ' ' : '') + sentence;
      
      // Reset overlap buffer and start building it for the next boundary
      overlapBuffer = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
      
      // Maintain overlap buffer
      if (overlapBuffer.length + sentence.length + 1 > overlapChars) {
        overlapBuffer = sentence;
      } else {
        overlapBuffer += (overlapBuffer ? ' ' : '') + sentence;
      }
    }
  }
  
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }
  
  return chunks;
}

/**
 * Main function to generate vectorized chunks from profile data.
 */
export function createAdvancedChunks(profileData: ProfileData, maxChunkSize: number = 1500): TextChunk[] {
  const chunks: TextChunk[] = [];
  const overlapSize = Math.floor(maxChunkSize * 0.2); // 20% overlap

  if (profileData.personalData) {
    chunks.push(...processPersonalData(profileData.personalData, maxChunkSize, overlapSize));
  }

  if (profileData.experiences?.length) {
    chunks.push(...processExperiences(profileData.experiences, maxChunkSize, overlapSize));
  }

  if (profileData.projects?.length) {
    chunks.push(...processProjects(profileData.projects, maxChunkSize, overlapSize));
  }

  if (profileData.educations?.length) {
    chunks.push(...processEducations(profileData.educations, maxChunkSize, overlapSize));
  }

  if (profileData.skills?.length) {
    chunks.push(...processSkills(profileData.skills, maxChunkSize));
  }

  if (profileData.certificates?.length) {
    chunks.push(...processCertificates(profileData.certificates, maxChunkSize));
  }

  return chunks;
}

// --- Entity Processors ---

function processPersonalData(p: PersonalData, maxChunkSize: number, overlapSize: number): TextChunk[] {
  const chunks: TextChunk[] = [];
  
  const socialLinks = [p.linkedinUrl, p.githubUrl, p.websiteUrl, p.twitterUrl, p.facebookUrl]
    .filter(Boolean)
    .join(' | ');

  const details = [
    `${p.fullName} is a ${p.title || 'Professional'} based in ${p.location || 'various locations'}.`,
    p.summary || p.bio || p.objective,
    p.heroBio,
    (p.email || p.phone) ? `Contact: ${[p.email, p.phone].filter(Boolean).join(' | ')}` : null,
    socialLinks ? `Social Links: ${socialLinks}` : null,
    p.languages ? `Languages: ${p.languages}` : null,
    p.currentLearning ? `Currently Learning: ${p.currentLearning}` : null
  ].filter(Boolean).join('\n');

  const textChunks = chunkTextWithOverlap(details.trim(), maxChunkSize, overlapSize);

  textChunks.forEach((text, index) => {
    chunks.push({
      id: randomUUID(),
      type: 'personal',
      title: index === 0 ? `Professional Profile - ${p.fullName}` : `${p.fullName} - Additional Details`,
      text,
      metadata: {
        entityType: 'person',
        entityName: p.fullName,
        importance: 'high'
      }
    });
  });

  return chunks;
}

function processExperiences(experiences: Experience[], maxChunkSize: number, overlapSize: number): TextChunk[] {
  const chunks: TextChunk[] = [];
  
  experiences.forEach((exp, index) => {
    const isCurrent = !exp.endDate || exp.endDate.toLowerCase() === 'present';
    const timeframe = isCurrent ? 'current' : index === 0 ? 'recent' : 'past';
    
    const elements = [
      `${exp.position || 'Professional'} at ${exp.company} (${exp.startDate || 'N/A'} to ${exp.endDate || 'Present'})`,
      exp.location ? `Location: ${exp.location}` : null,
      exp.description,
      exp.achievements ? `Achievements: ${Array.isArray(exp.achievements) ? exp.achievements.join('; ') : exp.achievements}` : null
    ];
    
    const textChunks = chunkTextWithOverlap(elements.filter(Boolean).join('. '), maxChunkSize, overlapSize);
    
    textChunks.forEach((text, chunkIndex) => {
      chunks.push({
        id: randomUUID(),
        type: 'experience',
        title: chunkIndex === 0 ? `${isCurrent ? 'Current Role' : 'Work Experience'} - ${exp.company}` : `${exp.company} - Additional Details`,
        text,
        metadata: {
          entityType: 'experience',
          entityName: exp.company,
          timeframe: timeframe as any,
          importance: isCurrent ? 'high' : index === 0 ? 'medium' : 'low'
        }
      });
    });
  });

  return chunks;
}

function processProjects(projects: Project[], maxChunkSize: number, overlapSize: number): TextChunk[] {
  const chunks: TextChunk[] = [];

  projects.forEach((proj) => {
    const elements = [
      `Project: ${proj.title}`,
      proj.description,
      proj.features?.length ? `Features: ${proj.features.join(', ')}` : null,
      proj.skills?.length ? `Technologies: ${proj.skills.join(', ')}` : null,
      proj.liveUrl ? `Live Demo: ${proj.liveUrl}` : null,
      proj.githubUrl ? `Source Code: ${proj.githubUrl}` : null
    ];
    
    const textChunks = chunkTextWithOverlap(elements.filter(Boolean).join('. '), maxChunkSize, overlapSize);
    
    textChunks.forEach((text, chunkIndex) => {
      chunks.push({
        id: randomUUID(),
        type: 'project',
        title: chunkIndex === 0 ? `Project - ${proj.title}` : `${proj.title} - Additional Details`,
        text: text + (proj.featured ? ' (Featured Project)' : ''),
        metadata: {
          entityType: 'project',
          entityName: proj.title,
          importance: proj.featured ? 'medium' : 'low',
          skills: proj.skills || []
        }
      });
    });
  });

  return chunks;
}

function processEducations(educations: Education[], maxChunkSize: number, overlapSize: number): TextChunk[] {
  const chunks: TextChunk[] = [];

  educations.forEach((edu, index) => {
    const isCurrent = !edu.endDate || edu.endDate.toLowerCase() === 'present';
    
    const elements = [
      `${edu.degree || 'Degree'} at ${edu.institution} (${edu.startDate || 'N/A'} to ${edu.endDate || 'Present'})`,
      edu.field ? `Field: ${edu.field}` : null,
      edu.location ? `Location: ${edu.location}` : null,
      edu.grade ? `Grade: ${edu.grade}` : null,
      edu.description,
      edu.achievements ? `Achievements: ${Array.isArray(edu.achievements) ? edu.achievements.join('; ') : edu.achievements}` : null
    ];
    
    const textChunks = chunkTextWithOverlap(elements.filter(Boolean).join('. '), maxChunkSize, overlapSize);
    
    textChunks.forEach((text, chunkIndex) => {
      chunks.push({
        id: randomUUID(),
        type: 'education',
        title: chunkIndex === 0 ? `Education - ${edu.institution}` : `${edu.institution} - Additional Details`,
        text,
        metadata: {
          entityType: 'education',
          entityName: edu.institution,
          timeframe: isCurrent ? 'current' : 'past',
          importance: index === 0 ? 'medium' : 'low'
        }
      });
    });
  });

  return chunks;
}

function processSkills(skills: Skill[], maxChunkSize: number): TextChunk[] {
  const chunks: TextChunk[] = [];
  let currentBlock = 'Technical Skills and Proficiencies:\n';
  let chunkIndex = 0;

  skills.forEach((skill) => {
    const exp = skill.experienceYears ? ` (${skill.experienceYears} yrs)` : '';
    const skillLine = `- ${skill.name}${exp}\n`;
    
    if ((currentBlock + skillLine).length > maxChunkSize) {
      chunks.push(createSkillChunk(currentBlock, chunkIndex, skills));
      currentBlock = 'Technical Skills:\n' + skillLine;
      chunkIndex++;
    } else {
      currentBlock += skillLine;
    }
  });

  if (currentBlock.trim().length > 'Technical Skills:\n'.length) {
    chunks.push(createSkillChunk(currentBlock, chunkIndex, skills));
  }

  return chunks;
}

function createSkillChunk(text: string, index: number, allSkills: Skill[]): TextChunk {
  return {
    id: randomUUID(),
    type: 'skills',
    title: index === 0 ? 'Skills and Technologies' : `Additional Skills (${index + 1})`,
    text: text.trim(),
    metadata: {
      entityType: 'skills',
      entityName: 'Skills Overview',
      importance: 'high',
      skills: allSkills.map(s => s.name)
    }
  };
}

function processCertificates(certificates: Certificate[], maxChunkSize: number): TextChunk[] {
  const chunks: TextChunk[] = [];
  let currentBlock = '';
  let chunkIndex = 0;

  certificates.forEach((cert) => {
    const details = [
      cert.description ? `Desc: ${cert.description}` : null,
      cert.credentialUrl ? `URL: ${cert.credentialUrl}` : null,
      cert.skills?.length ? `Skills: ${cert.skills.join(', ')}` : null
    ].filter(Boolean).join('. ');
    
    const certBlock = `Cert: ${cert.title} (${cert.instituteName || 'N/A'}, ${cert.issueDate || 'N/A'}). ${details}\n\n`;

    if ((currentBlock + certBlock).length > maxChunkSize && currentBlock.length > 0) {
      chunks.push(createCertChunk(currentBlock, chunkIndex));
      currentBlock = certBlock;
      chunkIndex++;
    } else {
      currentBlock += certBlock;
    }
  });

  if (currentBlock.trim().length > 0) {
    chunks.push(createCertChunk(currentBlock, chunkIndex));
  }

  return chunks;
}

function createCertChunk(text: string, index: number): TextChunk {
  return {
    id: randomUUID(),
    type: 'certificate',
    title: index === 0 ? 'Certifications' : `Additional Certifications (${index + 1})`,
    text: text.trim(),
    metadata: {
      entityType: 'certificate',
      entityName: 'Certifications',
      importance: 'medium'
    }
  };
}

// Utility function to test chunk quality
export function analyzeChunks(chunks: TextChunk[]): void {
  console.log(`Total chunks: ${chunks.length}`);
  
  const byType = chunks.reduce((acc, chunk) => {
    acc[chunk.type] = ((acc[chunk.type] as number) || 0) + 1;
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