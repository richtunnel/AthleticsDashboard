import re

with open('/home/engine/project/src/components/games/GamesTable.tsx', 'r') as f:
    content = f.read()

old_block = """  const teams = teamsResponse?.data || [];
  // Banner dismiss state — re-checks localStorage when workbook changes
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);
  const [selectedBannerColumn, setSelectedBannerColumn] = useState<string>("");

  useEffect(() => {
    if (!selectedWorkbookId) {
      setBannerDismissed(false);
      return;
    }
    setBannerDismissed(localStorage.getItem(`dismissed-opponent-banner-${selectedWorkbookId}`) === "true");
    setSelectedBannerColumn("");
  }, [selectedWorkbookId]);

  const availableCustomColumns = useMemo(() => {
    const keys = new Set<string>();
    (games ?? []).forEach((game: any) => {
      if (game.customFields && typeof game.customFields === "object") {
        Object.keys(game.customFields).forEach((k) => keys.add(k));
      } else if (game.customData && typeof game.customData === "object") {
        Object.keys(game.customData).forEach((k) => keys.add(k));
      }
    });
    return Array.from(keys).sort();
  }, [games]);

  const hasTBDOpponents = useMemo(() => {
    if (!selectedWorkbookId || opponentColumnOverride || !games?.length) return false;
    const tbdCount = games.filter((g: any) => !g.opponent?.name).length;
    return tbdCount > games.length / 2;
  }, [games, selectedWorkbookId, opponentColumnOverride]);

  const handleDismissBanner = useCallback(() => {
    if (selectedWorkbookId) {
      localStorage.setItem(`dismissed-opponent-banner-${selectedWorkbookId}`, "true");
    }
    setBannerDismissed(true);
  }, [selectedWorkbookId]);

  const handleSaveBannerColumn = useCallback(() => {
    if (selectedWorkbookId && selectedBannerColumn) {
      setOpponentOverride(selectedWorkbookId, selectedBannerColumn);
    }
    handleDismissBanner();
  }, [selectedWorkbookId, selectedBannerColumn, setOpponentOverride, handleDismissBanner]);
  const opponents = opponentsResponse?.data || [];"""

new_block = """  const teams = teamsResponse?.data || [];
  const opponents = opponentsResponse?.data || [];"""

if old_block in content:
    content = content.replace(old_block, new_block)
    with open('/home/engine/project/src/components/games/GamesTable.tsx', 'w') as f:
        f.write(content)
    print("State removal: SUCCESS")
else:
    print("State removal: FAILED - block not found")