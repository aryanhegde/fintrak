const dashboardRoots = [
  "/transactions",
  "/accounts",
  "/categories",
  "/settings",
];

export function isProtectedPath(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    dashboardRoots.some(
      (root) => pathname === root || pathname.startsWith(`${root}/`)
    )
  );
}
