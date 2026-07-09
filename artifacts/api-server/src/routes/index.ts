import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import profilesRouter from "./profiles";
import socialRouter from "./social";
import musicRouter from "./music";
import analyticsRouter from "./analytics";
import adminRouter from "./admin";
import postsRouter from "./posts";
import supportRouter from "./support";
import ogRouter from "./og";
import storiesRouter from "./stories";
import galleryRouter from "./gallery";
import publicationsRouter from "./publications";
import discordRouter from "./discord";
import emailRouter from "./email";
import emailsnoahRouter from "./emailsnoah";
import botRouter from "./bot";
import cdnRouter from "./cdn";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(profilesRouter);
router.use(socialRouter);
router.use(musicRouter);
router.use(analyticsRouter);
router.use(adminRouter);
router.use(postsRouter);
router.use(supportRouter);
router.use(storiesRouter);
router.use(galleryRouter);
router.use(publicationsRouter);
router.use(discordRouter);
router.use(emailRouter);
router.use(emailsnoahRouter);
// botRouter must be before ogRouter: the OG catch-all GET /:username would
// otherwise intercept /api/bot and redirect it to ikiss.me/bot.
router.use(botRouter);
// CDN proxy: serve R2 files without public bucket access
router.use(cdnRouter);
// adminRouter already registers /api/og-home-image (public endpoint, no auth)
router.use(ogRouter);

export default router;
