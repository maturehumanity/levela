import { resetDatabase, db } from './models/db';
import { hashPassword } from './utils/auth';
import { PILLARS, Pillar } from './types';

console.log('Starting database seed...');

// Reset and initialize
resetDatabase();

const now = Date.now();
const oneMonthAgo = now - 30 * 24 * 60 * 60 * 1000;
const twoMonthsAgo = now - 60 * 24 * 60 * 60 * 1000;

// Demo users
const demoUsers = [
  {
    email: 'alice@levela.demo',
    password: 'demo123',
    name: 'Alice Johnson',
    bio: 'Community organizer and environmental advocate. Passionate about sustainable living.',
    avatar_url: 'https://i.pravatar.cc/150?img=1',
    is_verified: 1,
    is_admin: 1,
  },
  {
    email: 'bob@levela.demo',
    password: 'demo123',
    name: 'Bob Martinez',
    bio: 'Software engineer and educator. Teaching coding to underserved communities.',
    avatar_url: 'https://i.pravatar.cc/150?img=12',
    is_verified: 1,
    is_admin: 0,
  },
  {
    email: 'carol@levela.demo',
    password: 'demo123',
    name: 'Carol Chen',
    bio: 'Healthcare professional and volunteer coordinator.',
    avatar_url: 'https://i.pravatar.cc/150?img=5',
    is_verified: 0,
    is_admin: 0,
  },
  {
    email: 'david@levela.demo',
    password: 'demo123',
    name: 'David Kim',
    bio: 'Small business owner focused on ethical practices and community development.',
    avatar_url: 'https://i.pravatar.cc/150?img=14',
    is_verified: 1,
    is_admin: 0,
  },
  {
    email: 'emma@levela.demo',
    password: 'demo123',
    name: 'Emma Wilson',
    bio: 'Artist and cultural event organizer. Building bridges through art.',
    avatar_url: 'https://i.pravatar.cc/150?img=9',
    is_verified: 0,
    is_admin: 0,
  },
  {
    email: 'frank@levela.demo',
    password: 'demo123',
    name: 'Frank Rodriguez',
    bio: 'Project manager with a track record of delivering community initiatives.',
    avatar_url: 'https://i.pravatar.cc/150?img=13',
    is_verified: 1,
    is_admin: 0,
  },
  {
    email: 'grace@levela.demo',
    password: 'demo123',
    name: 'Grace Lee',
    bio: 'Educator and mentor. Committed to lifelong learning and knowledge sharing.',
    avatar_url: 'https://i.pravatar.cc/150?img=10',
    is_verified: 0,
    is_admin: 0,
  },
  {
    email: 'henry@levela.demo',
    password: 'demo123',
    name: 'Henry Patel',
    bio: 'Environmental scientist working on climate action projects.',
    avatar_url: 'https://i.pravatar.cc/150?img=15',
    is_verified: 1,
    is_admin: 0,
  },
  {
    email: 'iris@levela.demo',
    password: 'demo123',
    name: 'Iris Thompson',
    bio: 'Nonprofit director focused on economic empowerment and job training.',
    avatar_url: 'https://i.pravatar.cc/150?img=20',
    is_verified: 0,
    is_admin: 0,
  },
  {
    email: 'jack@levela.demo',
    password: 'demo123',
    name: 'Jack Brown',
    bio: 'Volunteer firefighter and community safety advocate.',
    avatar_url: 'https://i.pravatar.cc/150?img=11',
    is_verified: 0,
    is_admin: 0,
  },
];

console.log('Creating demo users...');

const userStmt = db.prepare(`
  INSERT INTO users (email, password_hash, name, bio, avatar_url, is_verified, is_admin, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const userIds: number[] = [];

for (const user of demoUsers) {
  const result = userStmt.run(
    user.email,
    hashPassword(user.password),
    user.name,
    user.bio,
    user.avatar_url,
    user.is_verified,
    user.is_admin,
    twoMonthsAgo,
    now
  );
  userIds.push(result.lastInsertRowid as number);
}

console.log(`Created ${userIds.length} users`);

// Create endorsements
console.log('Creating endorsements...');

const endorsementStmt = db.prepare(`
  INSERT INTO endorsements (rater_id, ratee_id, pillar, stars, comment, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const endorsements = [
  // Alice (id: 1) receives endorsements
  { rater: 2, ratee: 1, pillar: 'environment' as Pillar, stars: 5, comment: 'Alice has been instrumental in organizing our community cleanup events. Her dedication is inspiring!' },
  { rater: 3, ratee: 1, pillar: 'environment' as Pillar, stars: 5, comment: 'Outstanding environmental leadership.' },
  { rater: 4, ratee: 1, pillar: 'culture' as Pillar, stars: 5, comment: 'Alice brings people together with respect and empathy.' },
  { rater: 5, ratee: 1, pillar: 'responsibility' as Pillar, stars: 5, comment: 'Always reliable and follows through on commitments.' },
  
  // Bob (id: 2) receives endorsements
  { rater: 1, ratee: 2, pillar: 'education' as Pillar, stars: 5, comment: 'Bob is an exceptional teacher. His coding workshops have helped dozens of people start new careers.' },
  { rater: 6, ratee: 2, pillar: 'education' as Pillar, stars: 5, comment: 'Patient, knowledgeable, and genuinely cares about student success.' },
  { rater: 7, ratee: 2, pillar: 'culture' as Pillar, stars: 4, comment: 'Great at fostering inclusive learning environments.' },
  { rater: 8, ratee: 2, pillar: 'responsibility' as Pillar, stars: 5, comment: 'Bob always shows up prepared and on time.' },
  
  // Carol (id: 3) receives endorsements
  { rater: 1, ratee: 3, pillar: 'responsibility' as Pillar, stars: 5, comment: 'Carol coordinates volunteers with incredible efficiency and care.' },
  { rater: 9, ratee: 3, pillar: 'culture' as Pillar, stars: 5, comment: 'Respectful and compassionate in all interactions.' },
  { rater: 2, ratee: 3, pillar: 'responsibility' as Pillar, stars: 4, comment: 'Very dependable team member.' },
  
  // David (id: 4) receives endorsements
  { rater: 1, ratee: 4, pillar: 'economy' as Pillar, stars: 5, comment: 'David runs his business with integrity and gives back to the community.' },
  { rater: 5, ratee: 4, pillar: 'culture' as Pillar, stars: 5, comment: 'Ethical and fair in all business dealings.' },
  { rater: 6, ratee: 4, pillar: 'economy' as Pillar, stars: 4, comment: 'Creates jobs and supports local initiatives.' },
  
  // Emma (id: 5) receives endorsements
  { rater: 1, ratee: 5, pillar: 'culture' as Pillar, stars: 5, comment: 'Emma\'s art events bring our community together and celebrate diversity.' },
  { rater: 4, ratee: 5, pillar: 'culture' as Pillar, stars: 5, comment: 'Creative and inclusive event organizer.' },
  { rater: 7, ratee: 5, pillar: 'environment' as Pillar, stars: 4, comment: 'Uses sustainable materials and practices in her art.' },
  
  // Frank (id: 6) receives endorsements
  { rater: 2, ratee: 6, pillar: 'responsibility' as Pillar, stars: 5, comment: 'Frank delivers projects on time and within budget consistently.' },
  { rater: 4, ratee: 6, pillar: 'economy' as Pillar, stars: 4, comment: 'Manages resources effectively.' },
  { rater: 1, ratee: 6, pillar: 'responsibility' as Pillar, stars: 5, comment: 'Highly reliable project manager.' },
  
  // Grace (id: 7) receives endorsements
  { rater: 2, ratee: 7, pillar: 'education' as Pillar, stars: 5, comment: 'Grace is a lifelong learner who shares knowledge generously.' },
  { rater: 5, ratee: 7, pillar: 'culture' as Pillar, stars: 5, comment: 'Mentors young people with patience and wisdom.' },
  { rater: 3, ratee: 7, pillar: 'education' as Pillar, stars: 4, comment: 'Excellent educator and mentor.' },
  
  // Henry (id: 8) receives endorsements
  { rater: 1, ratee: 8, pillar: 'environment' as Pillar, stars: 5, comment: 'Henry\'s climate action work is making a real difference in our community.' },
  { rater: 5, ratee: 8, pillar: 'environment' as Pillar, stars: 5, comment: 'Scientifically rigorous and action-oriented.' },
  { rater: 2, ratee: 8, pillar: 'education' as Pillar, stars: 4, comment: 'Great at explaining complex environmental issues.' },
  
  // Iris (id: 9) receives endorsements
  { rater: 3, ratee: 9, pillar: 'economy' as Pillar, stars: 5, comment: 'Iris has helped hundreds of people find meaningful employment.' },
  { rater: 4, ratee: 9, pillar: 'economy' as Pillar, stars: 5, comment: 'Her job training programs are transforming lives.' },
  { rater: 6, ratee: 9, pillar: 'responsibility' as Pillar, stars: 5, comment: 'Iris is incredibly organized and follows through.' },
  
  // Jack (id: 10) receives endorsements
  { rater: 1, ratee: 10, pillar: 'responsibility' as Pillar, stars: 5, comment: 'Jack is always there when the community needs him.' },
  { rater: 3, ratee: 10, pillar: 'culture' as Pillar, stars: 5, comment: 'Respectful and dedicated to public safety.' },
  { rater: 9, ratee: 10, pillar: 'environment' as Pillar, stars: 4, comment: 'Protects our community and environment.' },
];

for (const endorsement of endorsements) {
  const timestamp = oneMonthAgo + Math.random() * (now - oneMonthAgo);
  endorsementStmt.run(
    userIds[endorsement.rater - 1],
    userIds[endorsement.ratee - 1],
    endorsement.pillar,
    endorsement.stars,
    endorsement.comment,
    Math.floor(timestamp),
    Math.floor(timestamp)
  );
}

console.log(`Created ${endorsements.length} endorsements`);

// Create evidence
console.log('Creating evidence...');

const evidenceStmt = db.prepare(`
  INSERT INTO evidence (user_id, pillar, title, description, visibility, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const evidenceItems = [
  { user: 1, pillar: 'environment' as Pillar, title: 'Community Cleanup Certificate', description: 'Led 5 community cleanup events in 2025', visibility: 'public' },
  { user: 2, pillar: 'education' as Pillar, title: 'Teaching Certification', description: 'Certified coding instructor with 3 years experience', visibility: 'public' },
  { user: 2, pillar: 'education' as Pillar, title: 'Student Success Stories', description: 'Portfolio of student projects and career outcomes', visibility: 'public' },
  { user: 4, pillar: 'economy' as Pillar, title: 'Business Ethics Award', description: 'Recognized for ethical business practices', visibility: 'public' },
  { user: 5, pillar: 'culture' as Pillar, title: 'Art Exhibition Photos', description: 'Documentation of 10+ community art events', visibility: 'public' },
  { user: 8, pillar: 'environment' as Pillar, title: 'Climate Research Publication', description: 'Published research on local climate adaptation', visibility: 'public' },
  { user: 9, pillar: 'economy' as Pillar, title: 'Job Placement Report', description: '85% job placement rate for program graduates', visibility: 'public' },
];

for (const evidence of evidenceItems) {
  const timestamp = oneMonthAgo + Math.random() * (now - oneMonthAgo);
  evidenceStmt.run(
    userIds[evidence.user - 1],
    evidence.pillar,
    evidence.title,
    evidence.description,
    evidence.visibility,
    Math.floor(timestamp),
    Math.floor(timestamp)
  );
}

console.log(`Created ${evidenceItems.length} evidence items`);

console.log('\n✅ Database seeded successfully!');
console.log('\nDemo login credentials:');
console.log('Email: alice@levela.demo (Admin)');
console.log('Email: bob@levela.demo');
console.log('Email: carol@levela.demo');
console.log('Password for all: demo123');
console.log('\nYou can login with any of the 10 demo accounts using password: demo123');
