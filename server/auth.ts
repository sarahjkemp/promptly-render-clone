import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";

declare global {
  namespace Express {
    interface Request {
      isAuthenticated(): boolean;
      login(user: any, done: (err?: any) => void): void;
      logout(done: (err?: any) => void): void;
      user?: any;
    }
  }
}

const SINGLE_USER_ID = 1;

function attachSingleUser(req: Request, _res: Response, next: NextFunction) {
  storage.getUser(SINGLE_USER_ID).then((user) => {
    req.user = user;
    req.isAuthenticated = () => true;
    req.login = (_user, done) => done();
    req.logout = (done) => done();
    next();
  }).catch(next);
}

export function setupAuth(app: Express) {
  app.use(attachSingleUser);

  app.post("/api/register", async (_req, res) => {
    const user = await storage.getUser(SINGLE_USER_ID);
    const companyProfile = await storage.getCompanyProfileByUserId(SINGLE_USER_ID);
    if (!user) return res.status(500).json({ message: "Single-user bootstrap missing" });
    const { password, ...userData } = user;
    res.status(200).json({ ...userData, companyProfile: companyProfile || null });
  });

  app.post("/api/login", async (_req, res) => {
    const user = await storage.getUser(SINGLE_USER_ID);
    const companyProfile = await storage.getCompanyProfileByUserId(SINGLE_USER_ID);
    if (!user) return res.status(500).json({ message: "Single-user bootstrap missing" });
    const { password, ...userData } = user;
    res.status(200).json({ ...userData, companyProfile: companyProfile || null });
  });

  app.post("/api/logout", async (_req, res) => {
    res.sendStatus(200);
  });

  app.post("/api/change-password", async (_req, res) => {
    res.json({ success: true, message: "Password changes are disabled in single-user mode." });
  });

  app.get("/api/user", async (_req, res) => {
    const user = await storage.getUser(SINGLE_USER_ID);
    const companyProfile = await storage.getCompanyProfileByUserId(SINGLE_USER_ID);
    if (!user) return res.status(500).json({ message: "Single-user bootstrap missing" });
    const { password, ...userData } = user;
    res.json({ ...userData, companyProfile: companyProfile || null });
  });

  app.locals.requireAuth = (_req: Request, _res: Response, next: NextFunction) => next();
  app.locals.requireAdmin = (_req: Request, _res: Response, next: NextFunction) => next();
}
