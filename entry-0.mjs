import { Mastra } from '@mastra/core';
import { MastraError } from '@mastra/core/error';
import { PinoLogger } from '@mastra/loggers';
import { MastraLogger, LogLevel } from '@mastra/core/logger';
import pino from 'pino';
import { MCPServer } from '@mastra/mcp';
import { Inngest, NonRetriableError } from 'inngest';
import { z } from 'zod';
import { PostgresStore } from '@mastra/pg';
import { realtimeMiddleware } from '@inngest/realtime';
import { InngestWorkflow, init } from '@mastra/inngest';
import { serve } from 'inngest/hono';

const sharedPostgresStorage = new PostgresStore({
  connectionString: process.env.DATABASE_URL || "postgresql://localhost:5432/mastra"
});

const inngest = new Inngest(
  process.env.NODE_ENV === "production" ? {
    id: "replit-agent-workflow",
    name: "Replit Agent Workflow System"
  } : {
    id: "mastra",
    baseUrl: "http://localhost:3000",
    isDev: true,
    middleware: [realtimeMiddleware()]
  }
);

init(inngest);
const inngestFunctions = [];
function inngestServe({
  mastra,
  inngest: inngest2
}) {
  const wfs = mastra.getWorkflows();
  const functions = /* @__PURE__ */ new Set();
  for (const wf of Object.values(wfs)) {
    if (!(wf instanceof InngestWorkflow)) {
      continue;
    }
    wf.__registerMastra(mastra);
    for (const f of wf.getFunctions()) {
      functions.add(f);
    }
  }
  for (const fn of inngestFunctions) {
    functions.add(fn);
  }
  let serveHost = void 0;
  if (process.env.NODE_ENV === "production") {
    if (process.env.REPLIT_DOMAINS) {
      serveHost = `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
    }
  } else {
    serveHost = "http://localhost:5000";
  }
  return serve({
    client: inngest2,
    functions: Array.from(functions),
    serveHost
  });
}

class ProductionPinoLogger extends MastraLogger {
  logger;
  constructor(options = {}) {
    super(options);
    this.logger = pino({
      name: options.name || "app",
      level: options.level || LogLevel.INFO,
      base: {},
      formatters: {
        level: (label, _number) => ({
          level: label
        })
      },
      timestamp: () => `,"time":"${new Date(Date.now()).toISOString()}"`
    });
  }
  debug(message, args = {}) {
    this.logger.debug(args, message);
  }
  info(message, args = {}) {
    this.logger.info(args, message);
  }
  warn(message, args = {}) {
    this.logger.warn(args, message);
  }
  error(message, args = {}) {
    this.logger.error(args, message);
  }
}
const mastra = new Mastra({
  storage: sharedPostgresStorage,
  // Register your workflows here
  workflows: {},
  // Register your agents here
  agents: {},
  mcpServers: {
    allTools: new MCPServer({
      name: "allTools",
      version: "1.0.0",
      tools: {}
    })
  },
  bundler: {
    // A few dependencies are not properly picked up by
    // the bundler if they are not added directly to the
    // entrypoint.
    externals: ["@slack/web-api", "inngest", "inngest/hono", "hono", "hono/streaming"],
    // sourcemaps are good for debugging.
    sourcemap: true
  },
  server: {
    host: "0.0.0.0",
    port: 5e3,
    middleware: [async (c, next) => {
      const mastra2 = c.get("mastra");
      const logger = mastra2?.getLogger();
      logger?.debug("[Request]", {
        method: c.req.method,
        url: c.req.url
      });
      try {
        await next();
      } catch (error) {
        logger?.error("[Response]", {
          method: c.req.method,
          url: c.req.url,
          error
        });
        if (error instanceof MastraError) {
          if (error.id === "AGENT_MEMORY_MISSING_RESOURCE_ID") {
            throw new NonRetriableError(error.message, {
              cause: error
            });
          }
        } else if (error instanceof z.ZodError) {
          throw new NonRetriableError(error.message, {
            cause: error
          });
        }
        throw error;
      }
    }],
    apiRoutes: [
      // This API route is used to register the Mastra workflow (inngest function) on the inngest server
      {
        path: "/api/inngest",
        method: "ALL",
        createHandler: async ({
          mastra: mastra2
        }) => inngestServe({
          mastra: mastra2,
          inngest
        })
        // The inngestServe function integrates Mastra workflows with Inngest by:
        // 1. Creating Inngest functions for each workflow with unique IDs (workflow.${workflowId})
        // 2. Setting up event handlers that:
        //    - Generate unique run IDs for each workflow execution
        //    - Create an InngestExecutionEngine to manage step execution
        //    - Handle workflow state persistence and real-time updates
        // 3. Establishing a publish-subscribe system for real-time monitoring
        //    through the workflow:${workflowId}:${runId} channel
      }
    ]
  },
  logger: process.env.NODE_ENV === "production" ? new ProductionPinoLogger({
    name: "Mastra",
    level: "info"
  }) : new PinoLogger({
    name: "Mastra",
    level: "info"
  })
});
if (Object.keys(mastra.getWorkflows()).length > 1) {
  throw new Error("More than 1 workflows found. Currently, more than 1 workflows are not supported in the UI, since doing so will cause app state to be inconsistent.");
}
if (Object.keys(mastra.getAgents()).length > 1) {
  throw new Error("More than 1 agents found. Currently, more than 1 agents are not supported in the UI, since doing so will cause app state to be inconsistent.");
}

export { mastra };
