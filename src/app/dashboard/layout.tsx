"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Container,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Popover,
  Paper,
  Divider,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  CalendarMonth,
  Groups,
  Settings,
  Logout,
  Menu as MenuIcon,
  LightMode,
  DarkMode,
  Notifications,
  Sync,
  Analytics,
  ImportExport,
  WorkHistory,
  Schedule,
} from "@mui/icons-material";
import { useColorScheme } from "@mui/material/styles";
import { VscGithubProject } from "react-icons/vsc";
import styles from "../../styles/logo.module.css";

const DRAWER_WIDTH = 240;

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: DashboardIcon },
  { name: "Games", href: "/dashboard/games", icon: CalendarMonth },
  { name: "Teams / Opponents", href: "/dashboard/opponents", icon: Groups },
  { name: "Calendar Sync", href: "/dashboard/gsync", icon: Sync },
  { name: "Manage Schedule", href: "", icon: Schedule },
  { name: "Import/Export", href: "", icon: ImportExport },
  { name: "Analytics", href: "", icon: Analytics },
  { name: "History", href: "", icon: WorkHistory },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

// Mock notifications - replace with real data from your API
const mockNotifications = [
  { id: 1, message: "Game vs Lincoln High confirmed", time: "2 hours ago", read: false },
  { id: 2, message: "Calendar sync completed", time: "5 hours ago", read: false },
  { id: 3, message: "New opponent added: Roosevelt HS", time: "1 day ago", read: true },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notifAnchorEl, setNotifAnchorEl] = useState<null | HTMLElement>(null);
  const { mode, setMode } = useColorScheme();

  const [notifications] = useState(mockNotifications);
  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!mode) {
    return null;
  }

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
    setNotifAnchorEl(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setNotifAnchorEl(null);
  };

  const toggleTheme = () => {
    setMode(mode === "light" ? "dark" : "light");
  };

  const drawer = (
    <Box>
      {/* Logo/Brand */}
      <Box sx={{ p: 3, borderBottom: 1, borderColor: "divider" }}>
        <Link className={`${styles["ad-hub-logo"]} flex d-flex`} href="/">
          adhub
          <VscGithubProject />
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
                    "&:hover": {
                      bgcolor: "primary.dark",
                    },
                    "& .MuiListItemIcon-root": {
                      color: "white",
                    },
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
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#f8fafc" }}>
      {/* Top App Bar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
          bgcolor: "white",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Toolbar>
          <IconButton color="inherit" aria-label="open drawer" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: "none" }, color: "text.primary" }}>
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1 }} />

          {/* Theme Toggle */}
          <IconButton onClick={toggleTheme} sx={{ mr: 1 }} color="default">
            {mode === "light" ? <DarkMode /> : <LightMode />}
          </IconButton>

          {/* Notifications Bell */}
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
            anchorOrigin={{
              vertical: "bottom",
              horizontal: "right",
            }}
            transformOrigin={{
              vertical: "top",
              horizontal: "right",
            }}
          >
            <Paper sx={{ width: 350, maxHeight: 400 }}>
              <Box sx={{ p: 2, borderBottom: 1, borderColor: "divider" }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Notifications
                </Typography>
              </Box>
              {notifications.length === 0 ? (
                <Box sx={{ p: 4, textAlign: "center" }}>
                  <Notifications sx={{ fontSize: 48, color: "text.secondary", mb: 1 }} />
                  <Typography color="text.secondary">No notifications</Typography>
                </Box>
              ) : (
                <List sx={{ p: 0 }}>
                  {notifications.map((notif, index) => (
                    <Box key={notif.id}>
                      <ListItem
                        sx={{
                          bgcolor: notif.read ? "transparent" : "action.hover",
                          "&:hover": { bgcolor: "action.selected" },
                        }}
                      >
                        <ListItemText
                          primary={notif.message}
                          secondary={notif.time}
                          primaryTypographyProps={{
                            fontSize: 14,
                            fontWeight: notif.read ? 400 : 600,
                          }}
                          secondaryTypographyProps={{ fontSize: 12 }}
                        />
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
              {session?.user?.name || "Dev User"}
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
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
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
        {/* Mobile drawer */}
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

        {/* Desktop drawer */}
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

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: "100vh",
        }}
      >
        {/* Toolbar spacer */}
        <Toolbar />

        {/* Page content with proper margins */}
        <Container maxWidth="xl" sx={{ py: 4 }}>
          {children}
        </Container>
      </Box>
    </Box>
  );
}
