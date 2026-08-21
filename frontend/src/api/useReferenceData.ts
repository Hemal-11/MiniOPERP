import { useEffect, useState } from "react";
import { apiRequest } from "./client";
import type { Category, Item, Location, User } from "./types";

export function useReferenceData() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiRequest<Location[]>("/locations"),
      apiRequest<Item[]>("/items"),
      apiRequest<Category[]>("/categories"),
    ])
      .then(([l, i, c]) => {
        setLocations(l);
        setItems(i);
        setCategories(c);
      })
      .finally(() => setLoading(false));
  }, []);

  return { locations, items, categories, loading };
}

export function useUsers(enabled: boolean) {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!enabled) return;
    apiRequest<User[]>("/users").then(setUsers).catch(() => setUsers([]));
  }, [enabled]);

  return users;
}
