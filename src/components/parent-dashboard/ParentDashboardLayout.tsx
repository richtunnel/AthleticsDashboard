"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { getFirstName } from "@/lib/utils/name";
import { Tooltip } from "@mui/material";
import {
  AppBar,
  Avatar,
  Badge,
  Box,
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
  Chip,
  Button,
} from "@mui/material";
import { Menu as MenuIcon, Dashboard, Chat, Settings, Logout, Notifications, CalendarMonth, Close, CheckCircle, Error as ErrorIcon, Info, Warning, SupportAgent, Sync, Campaign, DynamicFeed } from "@mui/icons-material";
import { CircularProjectIcon } from "../circle-logo/OpleticsLogo";
import DarkModeToggle from "@/components/layout/DarkModeToggle";
import { useTheme as customTheme } from "@mui/material/styles";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { MUIThemeProvider } from "@/app/theme-provider";
import { NotificationProvider, useNotifications } from "@/contexts/NotificationContext";
import { useChatNotifications } from "@/hooks/useChatNotifications";
import { formatDistanceToNow } from "date-fns";
import styles from "../../styles/logo.module.css";

const DRAWER_WIDTH = 240;

const navigation = [
  { name: "Overview", href: "/parent-dashboard", icon: Dashboard },
  { name: "Feed", href: "/parent-dashboard/feed", icon: DynamicFeed },
  { name: "Calendar", href: "/parent-dashboard/calendar", icon: Sync },
  { name: "Announcements", href: "/parent-dashboard/announcements", icon: Campaign },
  { name: "Chat", href: "/parent-dashboard/chat", icon: Chat },
  { name: "Settings", href: "/parent-dashboard/settings", icon: Settings },
];

interface ParentDashboardLayoutClientProps {
  children: React.ReactNode;
}

function ParentDashboardLayoutContent({ children }: ParentDashboardLayoutClientProps) {
  const { data: session } = useSession();
  const pathname = usePathname();

  // Connect to chat notification SSE stream for header bell notifications
  useChatNotifications("/api/parent/chat/notifications/stream");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
  const { mode } = useTheme();
  const theme = customTheme();
  const { notifications, removeNotification, clearNotifications, unreadCount } = useNotifications();

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
          href="/parent-dashboard"
          style={{
            color: mode === "dark" ? "#fff" : "#0f172a",
          }}
        >
          <CircularProjectIcon outerStrokeWidth={2} strokeWidth={4} color={mode === "dark" ? "#fff" : "currentColor"} />
          <span style={{ marginLeft: "2px", letterSpacing: "-0.65px" }}>opletics</span>
        </Link>
      </Box>

      {/* Navigation */}
      <List sx={{ px: 2, py: 2, flexGrow: 1 }}>
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <ListItem key={item.name} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                href={item.href}
                selected={isActive}
                onClick={() => {
                  if (mobileOpen) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 1.5,
                  "&.Mui-selected": {
                    bgcolor: "primary.main",
                    color: mode === "dark" ? "#191919ff" : "white",
                    "&:hover": { bgcolor: "primary.dark" },
                    "& .MuiListItemIcon-root, & .MuiListItemIcon-root svg": {
                      color: mode === "dark" ? "#0f172a" : "#fff",
                    },
                  },
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
                  <Icon sx={{ fontSize: 20 }} />
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

      {/* Sign Out */}
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
        <ListItemButton onClick={() => signOut({ callbackUrl: "/onboarding/parent-signup", redirect: true })} sx={{ borderRadius: 1.5 }}>
          <ListItemIcon sx={{ minWidth: 40 }}>
            <Logout sx={{ fontSize: 20 }} />
          </ListItemIcon>
          <ListItemText primary="Sign Out" primaryTypographyProps={{ fontSize: 14 }} />
        </ListItemButton>
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
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
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
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexGrow: 1, minWidth: 0 }}>
            {/* Drawer Toggle (Mobile) */}
            <IconButton color="inherit" aria-label="open drawer" edge="start" onClick={handleDrawerToggle} sx={{ display: { sm: "none" }, color: "text.primary", mr: 1 }}>
              <MenuIcon />
            </IconButton>
          </Box>

          {/* Dark Mode Toggle */}
          <DarkModeToggle />

          {/* Google Calendar Button */}
          <Tooltip title={calendarTooltip}>
            <IconButton component="a" href={calendarHref} target="_blank" rel="noopener noreferrer" sx={{ mr: { xs: 0.5, sm: 1 } }} color="default" aria-label="Open Google Calendar">
              <CalendarMonth />
            </IconButton>
          </Tooltip>

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
                            <Chip label={notif.type} size="small" color={getTypeColor(notif.type) as any} sx={{ height: 20, fontSize: 11, textTransform: "capitalize" }} />
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
              {getFirstName(session?.user?.name) ? `Hey ${getFirstName(session?.user?.name)}` : ""}
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
              <MenuItem component={Link} href="/parent-dashboard/settings" onClick={handleClose}>
                <ListItemIcon>
                  <SupportAgent fontSize="small" />
                </ListItemIcon>
                Support
              </MenuItem>
              <MenuItem
                onClick={() => {
                  handleClose();
                  signOut({ callbackUrl: "/onboarding/parent-signup", redirect: true });
                }}
              >
                <ListItemIcon>
                  <Logout fontSize="small" />
                </ListItemIcon>
                Sign out
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar Drawer */}
      <Box
        component="nav"
        sx={{
          width: { xs: 0, sm: DRAWER_WIDTH },
          flexShrink: { sm: 0 },
        }}
      >
        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", sm: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: DRAWER_WIDTH,
              borderRight: 1,
              borderColor: "divider",
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
            },
          }}
        >
          {drawer}
        </Drawer>

        {/* Desktop Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", sm: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: DRAWER_WIDTH,
              borderRight: 1,
              borderColor: "divider",
              borderTopLeftRadius: 0,
              borderBottomLeftRadius: 0,
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        id="main-content"
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: "100vh",
        }}
      >
        <Toolbar />
        <Container
          maxWidth={false}
          sx={{
            py: { xs: 2, sm: 3, md: 4 },
            px: { xs: 2, sm: 3 },
            maxWidth: { xs: "100%", sm: "1536px" },
            mx: "auto",
          }}
        >
          {children}
        </Container>
      </Box>
    </Box>
  );
}

export default function ParentDashboardLayoutClient({ children }: ParentDashboardLayoutClientProps) {
  return (
    <ThemeProvider>
      <ParentDashboardLayoutWithTheme>{children}</ParentDashboardLayoutWithTheme>
    </ThemeProvider>
  );
}

function ParentDashboardLayoutWithTheme({ children }: ParentDashboardLayoutClientProps) {
  const { mode } = require("@/contexts/ThemeContext").useTheme();

  return (
    <MUIThemeProvider mode={mode}>
      <NotificationProvider>
        <ParentDashboardLayoutContent>{children}</ParentDashboardLayoutContent>
      </NotificationProvider>
    </MUIThemeProvider>
  );
}
