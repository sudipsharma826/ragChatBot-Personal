import { randomUUID } from 'crypto';

/** Normalize embedding vector dimensions (ensure 384) */
export function normalizeEmbeddingDimensions(
  embedding: number[],
  target = 384,
): number[] {
  if (embedding.length > target) return embedding.slice(0, target);
  if (embedding.length < target)
    return [...embedding, ...Array(target - embedding.length).fill(0)];
  return embedding;
}

//Generating the text chunks from profile data

/** Utility: Split text into 1–5 sentence chunks */
function splitIntoSentenceChunks(
  text: string,
  minSentences = 1,
  maxSentences = 5,
): string[] {
  // Split by sentence endings (., !, ?, newline)
  const sentences = text
    .match(/[^.!?\n]+[.!?\n]*/g)
    ?.map((s) => s.trim())
    .filter(Boolean) || [text.trim()];
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += maxSentences) {
    const group = sentences
      .slice(i, i + maxSentences)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (group.length > 0) chunks.push(group);
  }
  return chunks;
}

export function createTextChunks(profileData: any) {
  const chunks: any[] = [];

  // --------- Personal Info ---------
  if (profileData.personalData) {
    const p = profileData.personalData;
    const text = `
Name: ${p.fullName}
Title: ${p.title}
Location: ${p.location}
Bio: ${p.bio}
Objective: ${p.objective}
Summary: ${p.summary}
Hero Bio: ${p.heroBio}
Email: ${p.email}
Phone: ${p.phone}
Website: ${p.websiteUrl}
LinkedIn: ${p.linkedinUrl}
GitHub: ${p.githubUrl}
Facebook: ${p.facebookUrl}
Languages: ${p.languages}
Hobbies: ${p.hobbies}
Current Learning: ${p.currentLearning}
`.trim();

    splitIntoSentenceChunks(text).forEach((chunkText, idx) => {
      chunks.push({
        id: randomUUID(),
        type: 'personal',
        title: `${p.fullName} - Personal Info (${idx + 1})`,
        text: chunkText,
      });
    });
  }

  // --------- Experiences ---------
  profileData.experiences?.forEach((exp: any) => {
    const text = `
Company: ${exp.company}
Position: ${exp.position}
Location: ${exp.location}
Period: ${exp.startDate} to ${exp.endDate || 'Present'}
Description: ${exp.description}
Achievements: ${Array.isArray(exp.achievements) ? exp.achievements.join(', ') : exp.achievements || 'N/A'}
`.trim();

    splitIntoSentenceChunks(text).forEach((chunkText, idx) => {
      chunks.push({
        id: randomUUID(),
        type: 'experience',
        title: `${exp.company} - ${exp.position} (${idx + 1})`,
        text: chunkText,
      });
    });
  });

  // --------- Education ---------
  profileData.educations?.forEach((edu: any) => {
    const text = `
Institution: ${edu.institution}
Degree: ${edu.degree}
Field: ${edu.field}
Location: ${edu.location}
Period: ${edu.startDate} to ${edu.endDate || 'Present'}
Grade: ${edu.grade || 'N/A'}
Description: ${edu.description}
Achievements: ${Array.isArray(edu.achievements) ? edu.achievements.join(', ') : edu.achievements || 'N/A'}
`.trim();

    splitIntoSentenceChunks(text).forEach((chunkText, idx) => {
      chunks.push({
        id: randomUUID(),
        type: 'education',
        title: `${edu.institution} - ${edu.degree} (${idx + 1})`,
        text: chunkText,
      });
    });
  });

  // --------- Skills ---------
  profileData.skills?.forEach((skill: any) => {
    const text = `
Skill: ${skill.name}
Years of Experience: ${skill.experienceYears}
`.trim();

    chunks.push({
      id: randomUUID(),
      type: 'skill',
      title: `Skill - ${skill.name}`,
      text,
    });
  });

  // --------- Projects ---------
  profileData.projects?.forEach((proj: any) => {
    const text = `
Project: ${proj.title}
Description: ${proj.description}
Features: ${Array.isArray(proj.features) ? proj.features.join(', ') : 'N/A'}
Skills Used: ${Array.isArray(proj.skills) ? proj.skills.join(', ') : 'N/A'}
Live URL: ${proj.liveUrl || 'N/A'}
GitHub URL: ${proj.githubUrl || 'N/A'}
Featured: ${proj.featured ? 'Yes' : 'No'}
`.trim();

    splitIntoSentenceChunks(text).forEach((chunkText, idx) => {
      chunks.push({
        id: randomUUID(),
        type: 'project',
        title: `${proj.title} (${idx + 1})`,
        text: chunkText,
      });
    });
  });

  // --------- Certificates ---------
  profileData.certificates?.forEach((cert: any) => {
    const text = `
Certificate: ${cert.title}
Institute: ${cert.instituteName}
Issue Date: ${cert.issueDate}
Description: ${cert.description || 'N/A'}
Credential URL: ${cert.credentialUrl || 'N/A'}
Featured: ${cert.featured ? 'Yes' : 'No'}
Skills: ${Array.isArray(cert.skills) ? cert.skills.join(', ') : 'N/A'}
`.trim();

    splitIntoSentenceChunks(text).forEach((chunkText, idx) => {
      chunks.push({
        id: randomUUID(),
        type: 'certificate',
        title: `${cert.title} (${idx + 1})`,
        text: chunkText,
      });
    });
  });

  return chunks;
}
