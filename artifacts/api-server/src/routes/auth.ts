import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

/** POST /api/auth/login */
router.post("/login", async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email и пароль обязательны" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.trim().toLowerCase()));
  if (!user || !user.isActive) {
    res.status(401).json({ error: "Неверный email или пароль" });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Неверный email или пароль" });
    return;
  }
  req.session.userId = user.id;
  const { passwordHash: _, ...publicUser } = user;
  res.json(publicUser);
});

/** POST /api/auth/logout */
router.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

/** GET /api/auth/me — текущий авторизованный пользователь */
router.get("/me", requireAuth, (req, res) => {
  res.json(req.user);
});

export default router;
