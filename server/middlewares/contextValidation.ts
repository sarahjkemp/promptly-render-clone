import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

declare global {
  namespace Express {
    interface Request {
      companyProfile?: any;
    }
  }
}

export async function validateCompanyContext(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const userId = req.user!.id;
    const companyProfile = await storage.getCompanyProfileByUserId(userId);
    
    if (!companyProfile) {
      return res.status(404).json({ message: "Company profile not found" });
    }

    const industry = companyProfile.industry || companyProfile.industryCustom;
    if (!industry || industry.trim() === '') {
      return res.status(400).json({ 
        message: "Company industry is required for content generation",
        code: "INDUSTRY_REQUIRED"
      });
    }

    if (!companyProfile.keywords || companyProfile.keywords.length === 0) {
      return res.status(422).json({ 
        message: "Company keywords are required for content generation",
        code: "KEYWORDS_REQUIRED"
      });
    }

    if (!companyProfile.targetRegions || companyProfile.targetRegions.length === 0) {
      return res.status(422).json({ 
        message: "Target regions are required for content generation",
        code: "TARGET_REGIONS_REQUIRED"
      });
    }

    // Attach profile to request for downstream use
    req.companyProfile = companyProfile;
    next();
  } catch (error) {
    console.error("Context validation error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
}