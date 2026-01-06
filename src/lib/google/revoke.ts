export async function revokeGoogleToken(token: string): Promise<boolean> {
  const params = new URLSearchParams({ token });

  try {
    const response = await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    return response.ok;
  } catch (error) {
    console.error("Error revoking Google token:", error);
    return false;
  }
}
