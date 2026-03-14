import NextAuth from "next-auth";
import { parentAuthOptions } from "@/lib/utils/parentAuthOptions";

const handler = NextAuth(parentAuthOptions);
export { handler as GET, handler as POST };
