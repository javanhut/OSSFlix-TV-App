import type React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react-native";

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithQuery(ui: React.ReactElement, options: { client?: QueryClient } & RenderOptions = {}) {
  const { client = makeQueryClient(), ...renderOptions } = options;
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
