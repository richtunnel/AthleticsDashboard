"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Tooltip, useMediaQuery } from "@mui/material";
import { getFirstName } from "@/lib/utils/name";
import FeedbackIcon from "@mui/icons-material/Feedback";
import { useQuery } from "@tanstack/react-query";
import { trackEvent } from "@/lib/analytics/mixpanel.services";

import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Popover,
  Toolbar,
  Typography,
} from "@mui/material";

import {
  Chat,
  Dashboard as DashboardIcon,
  CalendarMonth,
  Groups,
  Settings,
  Logout,
  Menu as MenuIcon,
  Notifications,
  Close,
  CheckCircle,
  Error as ErrorIcon,
  Info,
  Warning,
  WorkHistory,
  Analytics,
  ChevronLeft,
  ChevronRight,
  Person,
  HelpOutline,
  SupportAgent,
  Newspaper,
  MenuBook,
  LightbulbOutlined,
} from "@mui/icons-material";

import DepartureBoardIcon from "@mui/icons-material/DepartureBoard";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import { VscGithubProject } from "react-icons/vsc";
import { RiCalendarScheduleFill } from "react-icons/ri";
import EmailIcon   from "@mui/icons-material/Email";
import SearchIcon   from "@mui/icons-material/Search";

import styles from "../../styles/logo.module.css";
import { NotificationProvider, useNotifications } from "@/contexts/NotificationContext";
import { TipsProvider } from "@/contexts/TipsContext";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import { useNavigationStore } from "@/lib/stores/navigationStore";
import ReferralShareButton from "@/components/layout/ReferralShareButton";
import SupportModal from "@/components/support/SupportModal";
import { MUIThemeProvider } from "@/app/theme-provider";
import DarkModeToggle from "@/components/layout/DarkModeToggle";
import { useTheme as customTheme } from "@mui/material/styles";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import BookDemoButton from "@/components/buttons/BookDemoButton";
import { CircularProjectIcon } from "@/components/circle-logo/OpleticsLogo";
import { ParentsAndAthletesMenu } from "@/components/parents/ParentsAndAthletesMenu";

const DRAWER_WIDTH = 240;

const baseNavigation = [
  { name: "Dashboard",     href: "/dashboard",              icon: DashboardIcon },
  { name: "Game Center",   href: "/dashboard/games",        icon: CalendarMonth },
  { name: "Email Manager", href: "/dashboard/email-groups", icon: EmailIcon },
  { name: "Calendars",     href: "/dashboard/gsync",        icon: EditCalendarIcon },
  { name: "Teams",         href: "/dashboard/opponents",    icon: Groups, requiresScoreTracker: true },
  { name: "Connect",        href: "/dashboard/parents",      icon: Person },
  { name: "Community",     href: "/dashboard/posts",        icon: Newspaper },
  { name: "Chat",          href: "/dashboard/ad-chat",      icon: Chat },
  { name: "Find Games",    href: "/schedule-board",         icon: SearchIcon, external: true, requiresVisible: "findGames" },
  // { name: "Analytics", href: "/dashboard/analytics", icon: Analytics },
  { name: "Settings",      href: "/dashboard/settings",     icon: Settings },
  // { name: "Travel AI", href: "/dashboard/travel-ai", icon: DepartureBoardIcon },
];

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();

  // Connect to chat notification SSE stream for header bell notifications
  useChatNotifications("/api/chat/notifications/stream");

  // Fetch score tracker setting
  const { data: scoreTrackerData } = useQuery({
    queryKey: ["scoreTrackerEnabled"],
    queryFn: async () => {
      const res = await fetch("/api/user/score-tracker");
      if (!res.ok) throw new Error("Failed to fetch score tracker setting");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch menu visibility preferences
  const { data: menuVisibility } = useQuery({
    queryKey: ["menuVisibility"],
    queryFn: async () => {
      const res = await fetch("/api/user/menu-visibility");
      if (!res.ok) throw new Error("Failed to fetch menu visibility");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // AD chat unread count for the Chat nav badge
  const { data: adChatUnread } = useQuery({
    queryKey:  ["adChatUnread"],
    queryFn:   () => fetch("/api/ad-chat/unread").then((r) => r.json()) as Promise<{ count: number }>,
    staleTime: 30_000,
    enabled:   !!session?.user?.id,
  });
  const adUnreadCount = adChatUnread?.count ?? 0;

  const isScoreTrackerEnabled = scoreTrackerData?.scoreTrackerEnabled ?? false;

  // Filter navigation based on feature toggles and user preferences
  const navigation = baseNavigation.filter((item) => {
    if (item.requiresScoreTracker && !isScoreTrackerEnabled) return false;
    if (item.href === "/dashboard/posts"    && menuVisibility?.hidePostsMenu)     return false;
    if (item.href === "/dashboard/parents"  && menuVisibility?.hideParentsMenu)   return false;
    if (item.requiresVisible === "findGames" && menuVisibility?.hideFindGamesMenu) return false;
    return true;
  });
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const { notifications, removeNotification, clearNotifications, unreadCount } = useNotifications();
  const { isLeftNavOpen, toggleLeftNav } = useNavigationStore();
  const [mounted, setMounted] = useState(false);
  const { mode } = useTheme();
  const theme = customTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isSidebarVisible = mounted ? isLeftNavOpen : true;
  // At ≤ 1440px use the mobile temporary drawer + hamburger; above that use the permanent sidebar
  const useHamburger = useMediaQuery("(max-width: 1440px)");
  const { setLeftNavOpen } = useNavigationStore();

  // Auto-hide the permanent sidebar when viewport drops to ≤ 1440px
  useEffect(() => {
    if (useHamburger) setLeftNavOpen(false);
  }, [useHamburger, setLeftNavOpen]);

  const calendarAccountEmail = session?.user?.googleCalendarEmail || session?.user?.email || null;
  const calendarHref = calendarAccountEmail ? `https://calendar.google.com/calendar/u/0/r?account=${encodeURIComponent(calendarAccountEmail)}` : "https://calendar.google.com/calendar/u/0/r";
  const calendarTooltip = calendarAccountEmail ? `Open Google Calendar for ${calendarAccountEmail}` : "Open Google Calendar";

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);
  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => setNotifAnchorEl(event.currentTarget);
  const handleNotificationClose = () => setNotifAnchorEl(null);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle sx={{ color: "success.main", fontSize: 20, mr: 1 }} />;
      case "error":
        return <ErrorIcon sx={{ color: "error.main", fontSize: 20, mr: 1 }} />;
      case "warning":
        return <Warning sx={{ color: "warning.main", fontSize: 20, mr: 1 }} />;
      default:
        return <Info sx={{ color: "info.main", fontSize: 20, mr: 1 }} />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "success":
        return "success";
      case "error":
        return "error";
      case "warning":
        return "warning";
      default:
        return "info";
    }
  };

  // ── Clean mobile nav (used at ≤ 1440px, separate from the desktop sidebar) ──
  const mobileNavContent = (
    <Box sx={{ width: 280, display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header */}
      <Box sx={{ px: 2.5, py: 2, display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: 1, borderColor: "divider" }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 6, color: mode === "dark" ? "#fff" : "#0f172a" }}>
          <CircularProjectIcon color={mode === "dark" ? "#fff" : "currentColor"} />
          <span style={{ fontWeight: 800, letterSpacing: "-0.65px", fontSize: "1rem" }}>opletics</span>
        </Link>
        <IconButton size="small" onClick={handleDrawerToggle} sx={{ color: "text.secondary" }}>
          <Close fontSize="small" />
        </IconButton>
      </Box>

      {/* Nav items */}
      <List sx={{ flex: 1, px: 1.5, py: 1.5, overflowY: "auto" }}>
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = !item.external && pathname === item.href;
          return (
            <ListItem key={item.name} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                href={item.href}
                {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                onClick={handleDrawerToggle}
                sx={{
                  borderRadius: 2,
                  px: 1.5,
                  py: 1,
                  bgcolor: isActive ? "primary.main" : "transparent",
                  color: isActive ? "#fff" : "text.primary",
                  "&:hover": { bgcolor: isActive ? "primary.dark" : "action.hover" },
                }}
              >
                <ListItemIcon sx={{ minWidth: 36, color: "inherit" }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={item.name}
                  primaryTypographyProps={{ fontSize: "0.9rem", fontWeight: isActive ? 700 : 500 }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      {/* Footer */}
      <Box sx={{ px: 2, py: 2, borderTop: 1, borderColor: "divider" }}>
        <Typography variant="caption" color="text.disabled" noWrap>
          {session?.user?.name || session?.user?.email}
        </Typography>
      </Box>
    </Box>
  );

  const drawer = (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      {/* Logo / Brand */}
      <Box sx={{ p: 3, borderBottom: 1, borderColor: "divider" }}>
        <Link
          className={`${styles["ad-hub-logo"]} flex d-flex`}
          href="/"
          style={{
            color: mode === "dark" ? "#fff" : "#0f172a",
          }}
        >
          <CircularProjectIcon outerStrokeWidth={2} strokeWidth={4} color={mode === "dark" ? "#fff" : "currentColor"} />
          <span style={{ marginLeft: "2.5px" }}>opletics</span>
        </Link>
      </Box>

      {/* Navigation */}
      <List sx={{ px: 2, py: 2, flexGrow: 1 }}>
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = !item.external && pathname === item.href;
          return (
            <ListItem key={item.name} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                href={item.href}
                {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                selected={isActive}
                sx={{
                  borderRadius: 1.5,
                  "&.Mui-selected": {
                    bgcolor: "primary.main",
                    color: `${mode}` === "dark" ? "#191919ff" : "white",
                    "&:hover": { bgcolor: "primary.dark" },
                    "& .MuiListItemIcon-root, & .MuiListItemIcon-root svg": {
                      color: mode === "dark" ? "#0f172a" : "#fff",
                    },
                  },
                  // Remove hover halo in dark mode, make text bold instead
                  "&:hover":
                    mode === "dark"
                      ? {
                          bgcolor: "transparent",
                          "& .MuiListItemText-primary": {
                            fontWeight: 600,
                          },
                        }
                      : {},
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Badge
                    badgeContent={item.href === "/dashboard/ad-chat" ? (adUnreadCount || null) : null}
                    color="error"
                    max={99}
                    sx={{ "& .MuiBadge-badge": { fontSize: "0.6rem", minWidth: 16, height: 16, p: "0 4px" } }}
                  >
                    <Icon sx={{ fontSize: 20 }} />
                  </Badge>
                </ListItemIcon>
                <ListItemText
                  primary={item.name}
                  primaryTypographyProps={{
                    fontSize: 14,
                    fontWeight: isActive ? 600 : 400,
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>

      <Box
        sx={{
          mt: "auto",
          pt: 2,
          pb: 2,
          px: 2,
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <Link href="/dashboard/feedback" style={{ textDecoration: "none", display: "block" }}>
          <Typography
            onClick={() => {
              trackEvent("Leave Feedback Clicked", {
                source: "dashboard_sidebar",
                action: "open_feedback",
              });
            }}
            sx={{
              color: "text.disabled",
              fontSize: "0.875rem",
              fontWeight: 400,
              opacity: 0.6,
              textAlign: "center",
              letterSpacing: "0.02em",
              px: 2,
              py: 1,
              textShadow: "0 1px 0 rgba(255, 255, 255, 0.1)",
              cursor: "pointer",
              transition: "opacity 0.2s ease, color 0.2s ease",
              textTransform: "none",
              "&:hover": {
                opacity: 0.85,
                color: "text.secondary",
              },
              "&:focus-visible": {
                outline: "2px solid",
                outlineColor: "primary.main",
                outlineOffset: 2,
                opacity: 1,
              },
            }}
          >
            <FeedbackIcon />
            &nbsp; Leave Feedback
          </Typography>
        </Link>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Top App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: (!useHamburger && isSidebarVisible) ? `calc(100% - ${DRAWER_WIDTH}px)` : "100%",
          ml: (!useHamburger && isSidebarVisible) ? `${DRAWER_WIDTH}px` : 0,
          bgcolor: "transparent",
          borderBottom: "none",
          borderColor: "none",
          border: "none!important",
          borderRadius: "0",
          boxShadow: "none",
          transition: (theme) =>
            theme.transitions.create(["margin", "width"], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.shorter,
            }),
        }}
      >
        <Toolbar sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              flexGrow: 1,
              minWidth: 0,
            }}
          >
            {/* Hamburger — shown at ≤ 1440px, opens the temporary overlay drawer */}
            {useHamburger && (
              <IconButton color="inherit" aria-label="open drawer" edge="start" onClick={handleDrawerToggle} sx={{ color: "text.primary", mr: 1 }}>
                <MenuIcon />
              </IconButton>
            )}

            {/* Logo - shown when sidebar is collapsed (desktop > 1440px only) */}
            {!isSidebarVisible && !useHamburger && (
              <Box sx={{ mr: 2 }}>
                <Link
                  className={`${styles["ad-hub-logo"]} flex d-flex`}
                  href="/"
                  style={{
                    color: mode === "dark" ? "#fff" : "#0f172a",
                  }}
                >
                  <CircularProjectIcon color={mode === "dark" ? "#fff" : "currentColor"} />
                  <span style={{ marginLeft: "2px", letterSpacing: "-0.65px" }}>opletics</span>
                </Link>
              </Box>
            )}

            {/* Sidebar Toggle — chevron, only visible above 1440px */}
            {!useHamburger && (
              <IconButton onClick={toggleLeftNav} aria-label={isSidebarVisible ? "Hide navigation menu" : "Show navigation menu"} sx={{ color: "text.primary" }}>
                {isSidebarVisible ? <ChevronLeft /> : <ChevronRight />}
              </IconButton>
            )}

            {/* Horizontal Navigation (Desktop) — hidden; sidebar hamburger replaces it */}
            <Box
              sx={{
                display: (!useHamburger && !isSidebarVisible) ? "flex" : "none",
                alignItems: "center",
                gap: 0.5,
                flexGrow: 1,
                textDecoration: "none",
                minWidth: 0,
                overflowX: "auto",
                pr: 2,
                "&::-webkit-scrollbar": { display: "none" },
              }}
            >
              {navigation.map((item) => {
                const isActive = !item.external && pathname === item.href;
                return (
                  <Box
                    key={item.name}
                    component={Link}
                    href={item.href}
                    {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    sx={{
                      position: "relative",
                      px: 1.5,
                      py: 0.75,
                      borderRadius: 1,
                      color: isActive ? "primary.main" : "text.secondary",
                      fontWeight: isActive ? 600 : 500,
                      fontSize: 14,
                      textDecoration: "none",
                      display: "flex",
                      alignItems: "center",
                      whiteSpace: "nowrap",
                      bgcolor: "transparent",
                      boxShadow: "none",
                      transition: "color 0.2s ease, background-color 0.2s ease",
                      "&::after": {
                        content: '""',
                        position: "absolute",
                        left: 12,
                        right: 12,
                        bottom: 4,
                        height: 2,
                        borderRadius: 999,
                        backgroundColor: isActive ? "primary.main" : "transparent",
                        transition: "background-color 0.2s ease",
                      },
                      "&:hover": {
                        color: "primary.main",
                        bgcolor: (theme) => (theme.palette.mode === "dark" ? "transparent" : "action.hover"),
                        textDecoration: "none",
                        "&::after": {
                          backgroundColor: "primary.main",
                        },
                      },
                    }}
                  >
                    {item.name}
                  </Box>
                );
              })}
            </Box>
          </Box>

          {/* Dark Mode Toggle */}
          <DarkModeToggle />

          {/* Schedule Exchange Board */}
          <Tooltip title="Schedule Exchange Board — browse open game dates and request games from other ADs">
            <IconButton
              component="a"
              href="/schedule-board"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ mr: { xs: 0.5, sm: 1 } }}
              color="default"
              aria-label="Schedule Exchange Board"
            >
              <RiCalendarScheduleFill size={22} />
            </IconButton>
          </Tooltip>

          {/* Referral Share Button */}
          <Box sx={{ display: { xs: "none", sm: "block" } }}>
            <ReferralShareButton />
          </Box>

          {/* Notifications */}
          <IconButton onClick={handleNotificationClick} sx={{ mr: { xs: 0.5, sm: 2 } }} color="default">
            <Badge badgeContent={unreadCount} color="error">
              <Notifications />
            </Badge>
          </IconButton>

          {/* Notifications Popover */}
          <Popover
            open={Boolean(notifAnchorEl)}
            anchorEl={notifAnchorEl}
            onClose={handleNotificationClose}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
          >
            <Paper sx={{ width: { xs: "calc(100vw - 32px)", sm: 380 }, maxWidth: 380, maxHeight: 500 }}>
              <Box
                sx={{
                  p: 2,
                  borderBottom: 1,
                  borderColor: "divider",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Notifications
                </Typography>
                <Box sx={{ display: "flex", gap: 1 }}>
                  {notifications.length > 0 && (
                    <Button size="small" onClick={clearNotifications} sx={{ textTransform: "none" }}>
                      Clear All
                    </Button>
                  )}
                  <IconButton size="small" onClick={handleNotificationClose}>
                    <Close fontSize="small" />
                  </IconButton>
                </Box>
              </Box>

              {notifications.length === 0 ? (
                <Box sx={{ p: 4, textAlign: "center" }}>
                  <Notifications sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
                  <Typography color="text.secondary">No notifications</Typography>
                </Box>
              ) : (
                <List sx={{ p: 0, maxHeight: 400, overflow: "auto" }}>
                  {notifications.map((notif, index) => (
                    <Box key={notif.id}>
                      <ListItem
                        sx={{
                          py: 2,
                          px: 2,
                          "&:hover": { bgcolor: "action.hover" },
                          display: "flex",
                          alignItems: "flex-start",
                        }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: "flex", alignItems: "center", mb: 0.5, gap: 1 }}>
                            {getNotificationIcon(notif.type)}
                            <Chip
                              label={notif.type}
                              size="small"
                              color={getTypeColor(notif.type) as any}
                              sx={{
                                height: 20,
                                fontSize: 11,
                                textTransform: "capitalize",
                              }}
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                              {formatDistanceToNow(notif.timestamp, { addSuffix: true })}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            {notif.message}
                          </Typography>
                        </Box>
                        <IconButton size="small" onClick={() => removeNotification(notif.id)} sx={{ ml: 1 }}>
                          <Close fontSize="small" />
                        </IconButton>
                      </ListItem>
                      {index < notifications.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              )}
            </Paper>
          </Popover>

          {/* User Menu */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" sx={{ color: "text.secondary", display: { xs: "none", sm: "block" } }}>
              {getFirstName(session?.user?.name) ? `Hey ${getFirstName(session?.user?.name)}` : "loading..."}
            </Typography>
            <IconButton onClick={handleMenu} sx={{ p: 0 }} aria-label="Open profile menu" aria-haspopup="true" aria-expanded={Boolean(anchorEl)}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", color: "#fff" }} src={session?.user?.image || undefined} alt={session?.user?.name ? `${session.user.name}'s profile picture` : "Profile picture"}>
                {session?.user?.name ? (getFirstName(session?.user?.name) || "")[0] : ""}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              {/* Identity header — navigates to settings, no pointer cursor */}
              <Box
                component={Link}
                href="/dashboard/settings"
                onClick={handleClose}
                sx={{
                  display: "block",
                  px: 2,
                  py: 1.5,
                  textDecoration: "none",
                  cursor: "default",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Typography variant="body2" fontWeight={600} noWrap color="text.primary">
                  {session?.user?.name || ""}
                </Typography>
                <Typography variant="caption" noWrap sx={{ color: "text.disabled", display: "block" }}>
                  {session?.user?.email || ""}
                </Typography>
              </Box>
              <Divider />
              <MenuItem component="a" href="/dashboard/feature-tips" target="_blank" rel="noopener noreferrer" onClick={handleClose}>
                <ListItemIcon>
                  <LightbulbOutlined fontSize="small" />
                </ListItemIcon>
                Introduction
              </MenuItem>
              <MenuItem component="a" href="/docs" target="_blank" rel="noopener noreferrer" onClick={handleClose}>
                <ListItemIcon>
                  <MenuBook fontSize="small" />
                </ListItemIcon>
                Documentation
              </MenuItem>
              <MenuItem component={Link} href="/dashboard/support" onClick={handleClose}>
                <ListItemIcon>
                  <SupportAgent fontSize="small" />
                </ListItemIcon>
                Support
              </MenuItem>
              {/* <MenuItem
                onClick={() => {
                  handleClose();
                  setSupportModalOpen(true);
                }}
              >
                <ListItemIcon>
                  <HelpOutline fontSize="small" />
                </ListItemIcon>
                Account
              </MenuItem> */}

              <MenuItem
                onClick={() => {
                  handleClose();
                  // Force signOut to completely kill the session
                  signOut({ callbackUrl: "/?postLogout=true", redirect: true });
                }}
              >
                <ListItemIcon>
                  <Logout fontSize="small" />
                </ListItemIcon>
                Sign out
              </MenuItem>
              <MenuItem>
                <ListItemIcon>
                  <BookDemoButton />
                </ListItemIcon>
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar Drawer */}
      <Box
        component="nav"
        sx={{
          width: useHamburger ? 0 : (isSidebarVisible ? DRAWER_WIDTH : 0),
          flexShrink: 0,
          transition: (theme) =>
            theme.transitions.create("width", {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.shorter,
            }),
        }}
      >
        {/* Temporary mobile nav drawer — shown at ≤ 1440px */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: useHamburger ? "block" : "none",
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: 280,
              borderRight: 1,
              borderColor: "divider",
            },
          }}
        >
          {mobileNavContent}
        </Drawer>

        {/* Permanent Sidebar — only above 1440px */}
        {isSidebarVisible && !useHamburger && (
          <Drawer
            variant="permanent"
            sx={{
              display: "block",
              "& .MuiDrawer-paper": {
                boxSizing: "border-box",
                width: DRAWER_WIDTH,
                borderRight: 1,
                borderColor: "divider",
                borderTopLeftRadius: 0,
                borderBottomLeftRadius: 0,
                transition: (theme) =>
                  theme.transitions.create("width", {
                    easing: theme.transitions.easing.sharp,
                    duration: theme.transitions.duration.shorter,
                  }),
              },
            }}
            open
          >
            {drawer}
          </Drawer>
        )}
      </Box>

      {/* Main Content */}
      <Box
        id="main-content"
        component="main"
        sx={{
          flexGrow: 1,
          width: (!useHamburger && isSidebarVisible) ? `calc(100% - ${DRAWER_WIDTH}px)` : "100%",
          minHeight: "100vh",
          transition: (theme) =>
            theme.transitions.create(["width", "margin"], {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.shorter,
            }),
        }}
      >
        <Toolbar />
        <Container
          maxWidth={false}
          sx={{
            // Keep top padding on Dashboard and Game Center, or when the sidebar is collapsed
            pt: (pathname === "/dashboard" || pathname === "/dashboard/games" || !isSidebarVisible)
              ? { xs: 2, sm: 3, md: 4 }
              : { xs: 2, sm: 3, md: 0 },
            pb: { xs: 2, sm: 3, md: 4 },
            px: { xs: 2, sm: 3 },
            maxWidth: {
              xs: "100%",
              sm: isSidebarVisible ? "1755px" : "100%",
            },
            mx: "auto",
          }}
        >
          {children}
        </Container>
      </Box>

      {/* Support Modal */}
      <SupportModal open={supportModalOpen} onClose={() => setSupportModalOpen(false)} userName={session?.user?.name || undefined} />
    </Box>
  );
}

export default function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <DashboardLayoutContentWithTheme>{children}</DashboardLayoutContentWithTheme>
    </ThemeProvider>
  );
}

function DashboardLayoutContentWithTheme({ children }: { children: React.ReactNode }) {
  const { mode } = require("@/contexts/ThemeContext").useTheme();

  return (
    <MUIThemeProvider mode={mode}>
      <NotificationProvider>
        <TipsProvider>
          <DashboardLayoutContent>{children}</DashboardLayoutContent>
        </TipsProvider>
      </NotificationProvider>
    </MUIThemeProvider>
  );
}
