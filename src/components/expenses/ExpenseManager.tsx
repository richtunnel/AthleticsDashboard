"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  CircularProgress,
} from "@mui/material";
import { Edit, Trash2, Plus } from "lucide-react";
import { format, parseISO } from "date-fns";
import { GameExpense } from "../../../types/expenses";
import { ExpenseFormDialog } from "./ExpenseFormDialog";

interface Game {
  id: string;
  date: string;
  homeTeam: {
    name: string;
    level: string;
    sport: {
      name: string;
    };
  };
  opponent?: {
    name: string;
  };
  expense?: GameExpense | null;
}

export function ExpenseManager() {
  const queryClient = useQueryClient();
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: gamesData, isLoading: gamesLoading } = useQuery<{ data: Game[] }>({
    queryKey: ["games-with-expenses"],
    queryFn: async () => {
      const res = await fetch("/api/games");
      if (!res.ok) throw new Error("Failed to fetch games");
      return res.json();
    },
  });

  const { data: expensesData, isLoading: expensesLoading } = useQuery<{
    data: GameExpense[];
  }>({
    queryKey: ["expenses"],
    queryFn: async () => {
      const res = await fetch("/api/expenses");
      if (!res.ok) throw new Error("Failed to fetch expenses");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (gameId: string) => {
      const response = await fetch(`/api/expenses?gameId=${gameId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete expense");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expense-analytics"] });
      queryClient.invalidateQueries({ queryKey: ["games"] });
    },
  });

  const handleEdit = (game: Game) => {
    setSelectedGame(game);
    setDialogOpen(true);
  };

  const handleDelete = (gameId: string) => {
    if (confirm("Are you sure you want to delete this expense?")) {
      deleteMutation.mutate(gameId);
    }
  };

  const handleAdd = (game: Game) => {
    setSelectedGame(game);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedGame(null);
  };

  if (gamesLoading || expensesLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  const games = gamesData?.data || [];
  const expenses = expensesData?.data || [];

  const expenseMap = new Map(expenses.map((exp) => [exp.gameId, exp]));
  const gamesWithExpenses = games.map((game) => ({
    ...game,
    expense: expenseMap.get(game.id) || null,
  }));

  const gamesWithTrackedExpenses = gamesWithExpenses.filter((game) => game.expense);
  const gamesWithoutExpenses = gamesWithExpenses.filter((game) => !game.expense);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Expense Management
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Track and manage expenses for each game
        </Typography>
      </Box>

      {gamesWithTrackedExpenses.length > 0 && (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Games with Tracked Expenses
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Sport</TableCell>
                    <TableCell>Team</TableCell>
                    <TableCell>Opponent</TableCell>
                    <TableCell align="right">Travel</TableCell>
                    <TableCell align="right">Food</TableCell>
                    <TableCell align="right">Clothes</TableCell>
                    <TableCell align="right">Gifts</TableCell>
                    <TableCell align="right">Total</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gamesWithTrackedExpenses.map((game) => {
                    const expense = game.expense!;
                    const total =
                      expense.travelExpense +
                      expense.foodExpense +
                      expense.clothesExpense +
                      expense.giftsExpense;

                    return (
                      <TableRow key={game.id}>
                        <TableCell>
                          {format(parseISO(game.date), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>{game.homeTeam.sport.name}</TableCell>
                        <TableCell>
                          {game.homeTeam.name}
                          <br />
                          <Typography variant="caption" color="text.secondary">
                            {game.homeTeam.level}
                          </Typography>
                        </TableCell>
                        <TableCell>{game.opponent?.name || "N/A"}</TableCell>
                        <TableCell align="right">
                          ${expense.travelExpense.toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          ${expense.foodExpense.toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          ${expense.clothesExpense.toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          ${expense.giftsExpense.toFixed(2)}
                        </TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold">
                            ${total.toFixed(2)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(game)}
                            color="primary"
                          >
                            <Edit size={18} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(game.id)}
                            color="error"
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 size={18} />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {gamesWithoutExpenses.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Games Without Expenses
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add expense tracking to these games
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Sport</TableCell>
                    <TableCell>Team</TableCell>
                    <TableCell>Opponent</TableCell>
                    <TableCell align="center">Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {gamesWithoutExpenses.slice(0, 10).map((game) => (
                    <TableRow key={game.id}>
                      <TableCell>
                        {format(parseISO(game.date), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>{game.homeTeam.sport.name}</TableCell>
                      <TableCell>
                        {game.homeTeam.name}
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          {game.homeTeam.level}
                        </Typography>
                      </TableCell>
                      <TableCell>{game.opponent?.name || "N/A"}</TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          startIcon={<Plus size={16} />}
                          onClick={() => handleAdd(game)}
                          variant="outlined"
                        >
                          Add Expense
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {gamesWithoutExpenses.length > 10 && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Showing 10 of {gamesWithoutExpenses.length} games
              </Typography>
            )}
          </CardContent>
        </Card>
      )}

      {gamesWithTrackedExpenses.length === 0 && gamesWithoutExpenses.length === 0 && (
        <Card>
          <CardContent sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No games found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Create some games first to start tracking expenses
            </Typography>
          </CardContent>
        </Card>
      )}

      {selectedGame && (
        <ExpenseFormDialog
          open={dialogOpen}
          onClose={handleCloseDialog}
          gameId={selectedGame.id}
          gameInfo={{
            date: selectedGame.date,
            homeTeam: selectedGame.homeTeam,
            opponent: selectedGame.opponent,
          }}
          existingExpense={selectedGame.expense}
        />
      )}
    </Box>
  );
}
