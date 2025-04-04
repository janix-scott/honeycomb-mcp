import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { registerPrompts } from './index.js';

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
}));

// Mock path module
vi.mock('path', () => ({
  join: vi.fn(),
  dirname: vi.fn(),
  resolve: vi.fn(),
}));

describe('prompts module', () => {
  // Mock server
  const mockServer = {
    server: {
      setRequestHandler: vi.fn(),
    }
  };

  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();
    // Mock path.join to return a predictable path
    vi.mocked(path.join).mockReturnValue('/mocked/path/to/guidance.md');
  });

  describe('registerPrompts', () => {
    it('should register prompts list handler', () => {
      // Register prompts
      registerPrompts(mockServer as any);

      // Verify prompts/list handler was registered
      expect(mockServer.server.setRequestHandler).toHaveBeenCalledWith(
        { method: 'prompts/list' },
        expect.any(Function)
      );
    });

    it('should register prompts get handler', () => {
      // Register prompts
      registerPrompts(mockServer as any);

      // Verify prompts/get handler was registered
      expect(mockServer.server.setRequestHandler).toHaveBeenCalledWith(
        { method: 'prompts/get' },
        expect.any(Function)
      );
    });
  });

  describe('prompts/list handler', () => {
    it('should return list of available prompts', async () => {
      // Register prompts
      registerPrompts(mockServer as any);

      // Get the registered handler for prompts/list
      const listHandler = vi.mocked(mockServer.server.setRequestHandler).mock.calls.find(
        call => call[0].method === 'prompts/list'
      )?.[1];

      // Make sure handler was found
      expect(listHandler).toBeDefined();

      // Call the handler
      const result = await listHandler!({} as any);

      // Verify result structure
      expect(result).toHaveProperty('prompts');
      expect(result.prompts).toHaveLength(1);
      expect(result.prompts[0]).toHaveProperty('name', 'instrumentation-guidance');
      expect(result.prompts[0]).toHaveProperty('description');
      expect(result.prompts[0]).toHaveProperty('arguments');
      expect(result.prompts[0].arguments).toHaveLength(2);
      expect(result.prompts[0].arguments[0]).toHaveProperty('name', 'language');
      expect(result.prompts[0].arguments[1]).toHaveProperty('name', 'filepath');
    });
  });

  describe('prompts/get handler', () => {
    it('should return instrumentation guidance prompt', async () => {
      // Mock fs.readFileSync to return example guidance
      vi.mocked(fs.readFileSync).mockReturnValue('# Mock Instrumentation Guidance');

      // Register prompts
      registerPrompts(mockServer as any);

      // Get the registered handler for prompts/get
      const getHandler = vi.mocked(mockServer.server.setRequestHandler).mock.calls.find(
        call => call[0].method === 'prompts/get'
      )?.[1];

      // Make sure handler was found
      expect(getHandler).toBeDefined();

      // Call the handler with the instrumentation-guidance prompt
      const result = await getHandler!({
        params: {
          name: 'instrumentation-guidance',
          arguments: {
            language: 'JavaScript',
            filepath: '/app/index.js'
          }
        }
      } as any);

      // Verify result structure
      expect(result).toHaveProperty('messages');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toHaveProperty('role', 'user');
      expect(result.messages[0].content).toHaveProperty('type', 'text');
      
      // Verify text includes the language and filepath
      expect(result.messages[0].content.text).toContain('JavaScript');
      expect(result.messages[0].content.text).toContain('/app/index.js');
      expect(result.messages[0].content.text).toContain('Mock Instrumentation Guidance');
    });

    it('should use default values when arguments are not provided', async () => {
      // Mock fs.readFileSync to return example guidance
      vi.mocked(fs.readFileSync).mockReturnValue('# Mock Instrumentation Guidance');

      // Register prompts
      registerPrompts(mockServer as any);

      // Get the registered handler for prompts/get
      const getHandler = vi.mocked(mockServer.server.setRequestHandler).mock.calls.find(
        call => call[0].method === 'prompts/get'
      )?.[1];

      // Call the handler with no arguments
      const result = await getHandler!({
        params: {
          name: 'instrumentation-guidance'
        }
      } as any);

      // Verify default values are used
      expect(result.messages[0].content.text).toContain('your code');
      expect(result.messages[0].content.text).not.toMatch(/ for \/\w+/); // Check specifically for " for /path" pattern
    });

    it('should throw an error for unknown prompt', async () => {
      // Register prompts
      registerPrompts(mockServer as any);

      // Get the registered handler for prompts/get
      const getHandler = vi.mocked(mockServer.server.setRequestHandler).mock.calls.find(
        call => call[0].method === 'prompts/get'
      )?.[1];

      // Call the handler with an unknown prompt
      const promise = getHandler!({
        params: {
          name: 'unknown-prompt'
        }
      } as any);

      // Verify the handler throws an error
      await expect(promise).rejects.toThrow('Prompt not found: unknown-prompt');
    });

    it('should handle filesystem errors', async () => {
      // Mock fs.readFileSync to throw an error
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('File not found');
      });

      // Register prompts
      registerPrompts(mockServer as any);

      // Get the registered handler for prompts/get
      const getHandler = vi.mocked(mockServer.server.setRequestHandler).mock.calls.find(
        call => call[0].method === 'prompts/get'
      )?.[1];

      // Call the handler
      const promise = getHandler!({
        params: {
          name: 'instrumentation-guidance'
        }
      } as any);

      // Verify the handler throws an error
      await expect(promise).rejects.toThrow('Failed to read instrumentation guidance');
    });
  });
});
