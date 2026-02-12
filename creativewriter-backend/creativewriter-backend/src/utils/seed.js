/**
 * Database Seed Utility
 * Seeds the database with sample data for testing
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const mongoose = require('mongoose');
const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const Lyrics = require('../models/Lyrics');
const config = require('../config/config');

const seedData = async () => {
  try {
    // Connect to database
    await mongoose.connect(config.mongodb.uri, config.mongodb.options);
    console.log('Connected to MongoDB');

    // Clear existing data (optional - be careful in production!)
    if (process.argv.includes('--clear')) {
      console.log('Clearing existing data...');
      await User.deleteMany({});
      await ApiKey.deleteMany({});
      await Lyrics.deleteMany({});
      console.log('Data cleared');
    }

    // Create admin user
    let adminUser = await User.findOne({ email: config.defaultAdmin.email });
    if (!adminUser) {
      adminUser = await User.create({
        name: config.defaultAdmin.name,
        email: config.defaultAdmin.email,
        password: config.defaultAdmin.password,
        role: 'admin',
        isEmailVerified: true,
        profile: {
          organization: 'Akash InnoTech',
          phone: '+91 9876543210'
        }
      });
      console.log('✅ Admin user created');
    } else {
      console.log('✅ Admin user already exists');
    }

    // Create sample users
    const sampleUsers = [
      {
        name: 'రాము (Ramu)',
        email: 'ramu@example.com',
        password: 'User@123',
        role: 'user',
        profile: {
          organization: 'తెలుగు సాహిత్య సంస్థ',
          language: 'te'
        }
      },
      {
        name: 'లక్ష్మి (Lakshmi)',
        email: 'lakshmi@example.com',
        password: 'User@123',
        role: 'user',
        profile: {
          organization: 'Hyderabad Arts Academy',
          language: 'te'
        }
      },
      {
        name: 'Krishna Rao',
        email: 'krishna@example.com',
        password: 'User@123',
        role: 'user',
        profile: {
          organization: 'Telugu Film Industry',
          language: 'te'
        }
      }
    ];

    for (const userData of sampleUsers) {
      const existingUser = await User.findOne({ email: userData.email });
      if (!existingUser) {
        await User.create(userData);
        console.log(`✅ User created: ${userData.name}`);
      }
    }

    // Initialize API keys
    await ApiKey.initializeDefaults();

    // Create sample lyrics
    const users = await User.find({ role: 'user' });
    
    const sampleLyrics = [
      {
        title: 'వసంత గీతం',
        content: `【పల్లవి - Pallavi】
వసంతం వచ్చింది మా ఊరికి
పూలు పూసాయి మా తోటలో
పక్షులు పాడాయి మధుర గీతాలు
ప్రకృతి నవ్వింది ఆనందంతో

(Vasantam vacchindi maa ooriki
Poolu poosayi maa thotalo
Pakshulu paadaayi madhura geetaalu
Prakruti navvindi aanandamto)

【చరణం 1 - Charanam 1】
మామిడి పూతలు వెన్నెల్లో మెరిసాయి
కోయిల పాటలు అందంగా వినిపించాయి`,
        style: 'folk',
        dialect: 'coastal',
        poetryForm: 'geeyam',
        theme: 'వసంత ఋతువు',
        isFavorite: true
      },
      {
        title: 'భక్తి గీతం - వేంకటేశ్వర',
        content: `【పల్లవి - Pallavi】
గోవింద గోవింద గోవిందా
వేంకటేశ్వరా హరి గోవిందా
తిరుమల కొండపై నెలకొన్న దేవా
శ్రీనివాసా నీకు జై జై గోవిందా

(Govinda Govinda Govindaa
Venkateswaraa Hari Govindaa
Tirumala kondapai nelakonna devaa
Srinivaasa neeku jai jai Govindaa)`,
        style: 'devotional',
        dialect: 'rayalaseema',
        poetryForm: 'keertana',
        theme: 'వేంకటేశ్వర భక్తి',
        isPublic: true
      },
      {
        title: 'తెలంగాణ బతుకమ్మ',
        content: `【పల్లవి - Pallavi】
బతుకమ్మ బతుకమ్మ ఉయ్యాలో
తంగేడు పూలతో సజ్జలో
గౌరమ్మ గౌరమ్మ ఉయ్యాలో
బంగారు బొమ్మవో సజ్జలో

(Bathukamma Bathukamma uyyaalo
Tangedu poolato sajjalo
Gauramma Gauramma uyyaalo
Bangaaru bommavo sajjalo)`,
        style: 'folk',
        dialect: 'telangana',
        poetryForm: 'janapada',
        theme: 'బతుకమ్మ పండుగ',
        isFavorite: true,
        isPublic: true
      }
    ];

    for (let i = 0; i < sampleLyrics.length; i++) {
      const user = users[i % users.length];
      if (user) {
        const existing = await Lyrics.findOne({ 
          user: user._id, 
          title: sampleLyrics[i].title 
        });
        
        if (!existing) {
          await Lyrics.create({
            ...sampleLyrics[i],
            user: user._id
          });
          console.log(`✅ Lyrics created: ${sampleLyrics[i].title}`);
        }
      }
    }

    console.log('');
    console.log('🎉 Database seeding completed!');
    console.log('');
    console.log('📋 Test Credentials:');
    console.log('   Admin: admin@akashinnotech.com / Admin@123');
    console.log('   User:  ramu@example.com / User@123');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedData();
