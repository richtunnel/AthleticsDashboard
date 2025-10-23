"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Tooltip } from "@mui/material";

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
} from "@mui/icons-material";

import DepartureBoardIcon from "@mui/icons-material/DepartureBoard";
import EditCalendarIcon from "@mui/icons-material/EditCalendar";
import { VscGithubProject } from "react-icons/vsc";
import EmailIcon from "@mui/icons-material/Email";

import styles from "../../styles/logo.module.css";
import { NotificationProvider, useNotifications } from "@/contexts/NotificationContext";
import ThemeToggle from "@/components/theme/ThemeToggle";

const DRAWER_WIDTH = 240;

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: DashboardIcon },
  { name: "Game Center", href: "/dashboard/games", icon: CalendarMonth },
  { name: "Manage Teams", href: "/dashboard/opponents", icon: Groups },
  { name: "My Calendars", href: "/dashboard/gsync", icon: EditCalendarIcon },
  { name: "Manage Emais", href: "/dashboard/email-groups", icon: EmailIcon },
  { name: "Analytics", href: "/dashboard/analytics", icon: Analytics },
  { name: "Account", href: "/dashboard/settings", icon: Settings },
  { name: "Travel AI", href: "/dashboard/travel-ai", icon: DepartureBoardIcon },
];

function DashboardLayoutContent({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
  const { notifications, removeNotification, clearNotifications, unreadCount } = useNotifications();

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
    <Box>
      {/* Logo / Brand */}
      <Box sx={{ p: 3, borderBottom: 1, borderColor: "divider" }}>
        <Link href="/" className={`${styles["ad-hub-logo"]} flex d-flex`}>
          adhub <VscGithubProject />
        </Link>
      </Box>

      {/* Navigation */}
      <List sx={{ px: 2, py: 2 }}>
        {navigation.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <ListItem key={item.name} disablePadding sx={{ mb: 0.5 }}>
              <ListItemButton
                component={Link}
                href={item.href}
                selected={isActive}
                sx={{
                  borderRadius: 1.5,
                  "&.Mui-selected": {
                    bgcolor: "primary.main",
                    color: "white",
                    "&:hover": { bgcolor: "primary.dark" },
                    "& .MuiListItemIcon-root": { color: "white" },
                  },
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
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Toolbar>
          {/* Drawer Toggle (Mobile) */}
          <IconButton color="inherit" aria-label="open drawer" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: "none" }, color: "text.primary" }}>
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1 }} />

          {/* Google Calendar Button */}
          <Tooltip title="Open Google Calendar">
            <IconButton component="a" href="https://calendar.google.com" target="_blank" rel="noopener noreferrer" sx={{ mr: 1 }} color="default">
              <CalendarMonth />
            </IconButton>
          </Tooltip>

          {/* Theme Toggle */}
          <ThemeToggle sx={{ mr: 1 }} />

          {/* Notifications */}
          <IconButton onClick={handleNotificationClick} sx={{ mr: 2 }} color="default">
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
            <Paper sx={{ width: 380, maxHeight: 500 }}>
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
              {session?.user?.name || "loading..."}
            </Typography>
            <IconButton onClick={handleMenu} sx={{ p: 0 }}>
              <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main" }} src={session?.user?.image || undefined}>
                {(session?.user?.name || "D")[0]}
              </Avatar>
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
              transformOrigin={{ vertical: "top", horizontal: "right" }}
            >
              <MenuItem
                onClick={() => {
                  handleClose();
                  signOut();
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
      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
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
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: "100vh",
        }}
      >
        <Toolbar />
        <Container maxWidth="xl" sx={{ py: 4 }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </NotificationProvider>
  );
}
