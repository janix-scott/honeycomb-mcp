import { describe, it, expect, beforeEach, vi } from "vitest";
import { HoneycombAPI } from "./client.js";
import { Config } from "../config.js";
import { HoneycombError } from "../utils/errors.js";
import { Column } from "../types/column.js";

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock as unknown as typeof fetch;

describe("HoneycombAPI", () => {
  let api: HoneycombAPI;
  const testConfig: Config = {
    environments: [
      { name: "prod", apiKey: "prod-key" },
      { name: "dev", apiKey: "dev-key" },
    ],
  };

  beforeEach(() => {
    api = new HoneycombAPI(testConfig);
    fetchMock.mockReset();
    // Default success response
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
  });

  describe("environment handling", () => {
    it("lists configured environments", () => {
      expect(api.getEnvironments()).toEqual(["prod", "dev"]);
    });

    it("throws on unknown environment", async () => {
      await expect(api.listDatasets("unknown")).rejects.toThrow(/Unknown environment/);
    });
  });

  describe("dataset operations", () => {
    it("gets a single dataset", async () => {
      const dataset = { name: "test", slug: "test" };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(dataset),
      });

      const result = await api.getDataset("prod", "test");
      expect(result).toEqual(dataset);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.honeycomb.io/1/datasets/test",
        expect.any(Object),
      );
    });

    it("lists datasets", async () => {
      const datasets = [
        { name: "test1", slug: "test1" },
        { name: "test2", slug: "test2" },
      ];
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(datasets),
      });

      const result = await api.listDatasets("prod");
      expect(result).toEqual(datasets);
    });
  });

  describe("column operations", () => {
    it("gets columns for dataset", async () => {
      const columns: Partial<Column>[] = [
        { 
          key_name: "col1", 
          type: "string", 
          hidden: false,
          id: "1",
          description: "test",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
        { 
          key_name: "col2", 
          type: "integer", 
          hidden: false,
          id: "2",
          description: "test2",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ];

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(columns),
      });

      const result = await api.getColumns("prod", "test");
      expect(result).toEqual(columns);
    });

    it("gets visible columns only", async () => {
      const columns: Partial<Column>[] = [
        { 
          key_name: "col1", 
          type: "string", 
          hidden: false,
          id: "1",
          description: "test",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
        { 
          key_name: "col2", 
          type: "integer", 
          hidden: true,
          id: "2",
          description: "test2",
          created_at: "2024-01-01",
          updated_at: "2024-01-01",
        },
      ];

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(columns),
      });

      const result = await api.getVisibleColumns("prod", "test");
      expect(result).toHaveLength(1);
      expect(result[0]?.key_name).toBe("col1");
    });

    it("gets column by name", async () => {
      const column = { key_name: "col1", type: "string" };
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(column),
      });

      const result = await api.getColumnByName("prod", "test", "col1");
      expect(result).toEqual(column);
    });
  });

  describe("query operations", () => {
    it("handles successful query", async () => {
      // Mock sequence: create query -> create result -> get complete results
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "query-id" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "result-id" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ complete: true, data: { results: [] } }),
        });

      const result = await api.queryAndWaitForResults("prod", "dataset", {
        calculations: [{ op: "COUNT" }],
      });

      expect(result).toEqual({ complete: true, data: { results: [] } });
    });

    it("times out after max attempts", async () => {
      // Mock sequence: create query -> create result -> incomplete results
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "query-id" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "result-id" }),
        })
        .mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({ complete: false }),
        });

      await expect(
        api.queryAndWaitForResults("prod", "dataset", { calculations: [{ op: "COUNT" }] }, 2)
      ).rejects.toThrow(/timed out/);
    });
  });

  describe("error handling", () => {
    it("throws HoneycombError on API errors", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: "Too Many Requests",
      });

      await expect(api.listDatasets("prod")).rejects.toThrow(HoneycombError);
    });

    it("includes status code in error", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      });

      try {
        await api.listDatasets("prod");
      } catch (error) {
        expect(error).toBeInstanceOf(HoneycombError);
        expect((error as HoneycombError).statusCode).toBe(403);
      }
    });
  });
}); 