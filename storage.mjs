import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { pgTable, timestamp, text, integer, boolean, jsonb } from 'drizzle-orm/pg-core';

const players = pgTable("players", {
  telegramId: text("telegram_id").primaryKey(),
  username: text("username"),
  firstName: text("first_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
const playerRoles = pgTable("player_roles", {
  id: text("id").primaryKey(),
  telegramId: text("telegram_id").notNull().references(() => players.telegramId),
  roleId: text("role_id").notNull(),
  level: integer("level").default(1).notNull(),
  experience: integer("experience").default(0).notNull(),
  timesPlayed: integer("times_played").default(0).notNull(),
  lastPlayedAt: timestamp("last_played_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
const questProgress = pgTable("quest_progress", {
  id: text("id").primaryKey(),
  telegramId: text("telegram_id").notNull().references(() => players.telegramId),
  roleId: text("role_id").notNull(),
  level: integer("level").notNull(),
  currentStep: integer("current_step").default(0).notNull(),
  choices: jsonb("choices").default([]).notNull(),
  // Массив выборов игрока
  startedAt: timestamp("started_at").defaultNow().notNull(),
  lastActionAt: timestamp("last_action_at").defaultNow().notNull(),
  completed: boolean("completed").default(false).notNull(),
  reminderSent: boolean("reminder_sent").default(false).notNull()
});
const questHistory = pgTable("quest_history", {
  id: text("id").primaryKey(),
  telegramId: text("telegram_id").notNull().references(() => players.telegramId),
  roleId: text("role_id").notNull(),
  level: integer("level").notNull(),
  choices: jsonb("choices").notNull(),
  experienceGained: integer("experience_gained").notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull()
});
const reminders = pgTable("reminders", {
  id: text("id").primaryKey(),
  telegramId: text("telegram_id").notNull().references(() => players.telegramId),
  questProgressId: text("quest_progress_id").notNull().references(() => questProgress.id),
  scheduledFor: timestamp("scheduled_for").notNull(),
  sent: boolean("sent").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

var schema = /*#__PURE__*/Object.freeze({
  __proto__: null,
  playerRoles: playerRoles,
  players: players,
  questHistory: questHistory,
  questProgress: questProgress,
  reminders: reminders
});

const connectionString = process.env.DATABASE_URL;
const client = postgres(connectionString);
const db = drizzle(client, { schema });

export { playerRoles as a, questHistory as b, db as d, players as p, questProgress as q, reminders as r };
//# sourceMappingURL=storage.mjs.map
