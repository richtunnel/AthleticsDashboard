import NextAuth from "next-auth";
import { collaboratorAuthOptions } from "@/lib/utils/collaboratorAuthOptions";

const handler = NextAuth(collaboratorAuthOptions);

export { handler as GET, handler as POST };
