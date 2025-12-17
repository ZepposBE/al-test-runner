/**
 * XML parsing utilities for AL Test Runner results
 */

import { readFileSync, existsSync } from 'fs';
import { parseStringPromise } from 'xml2js';
import type { 
  TestAssembly, 
  TestCollection, 
  TestResult, 
  TestFailure,
  CodeCoverageLine,
  CodeCoverageSummary,
  ObjectCoverage
} from '../types';
import { getLastResultsPath, getCodeCoveragePath } from './config';

/**
 * Parse the last.xml test results file
 */
export async function parseTestResults(): Promise<TestAssembly[] | null> {
  const resultsPath = getLastResultsPath();
  
  if (!existsSync(resultsPath)) {
    return null;
  }

  try {
    const xml = readFileSync(resultsPath, 'utf-8');
    const result = await parseStringPromise(xml);
    
    if (!result.assemblies?.assembly) {
      return null;
    }

    const assemblies: TestAssembly[] = result.assemblies.assembly.map((assembly: any) => {
      const attrs = assembly.$;
      
      const collections: TestCollection[] = (assembly.collection || []).map((collection: any) => {
        const collAttrs = collection.$;
        
        const tests: TestResult[] = (collection.test || []).map((test: any) => {
          const testAttrs = test.$;
          
          let failure: TestFailure | undefined;
          if (test.failure && test.failure[0]) {
            const failureData = test.failure[0];
            failure = {
              message: Array.isArray(failureData.message) 
                ? failureData.message[0] || '' 
                : failureData.message || '',
              stackTrace: Array.isArray(failureData['stack-trace'])
                ? failureData['stack-trace'][0] || ''
                : failureData['stack-trace'] || '',
            };
          }

          return {
            name: testAttrs.name,
            method: testAttrs.method,
            result: testAttrs.result as 'Pass' | 'Fail' | 'Skip',
            time: parseFloat(testAttrs.time) || 0,
            failure,
          } as TestResult;
        });

        return {
          name: collAttrs.name,
          total: parseInt(collAttrs.total) || 0,
          passed: parseInt(collAttrs.passed) || 0,
          failed: parseInt(collAttrs.failed) || 0,
          skipped: parseInt(collAttrs.skipped) || 0,
          time: parseFloat(collAttrs.time) || 0,
          tests,
        } as TestCollection;
      });

      return {
        name: attrs.name,
        total: parseInt(attrs.total) || 0,
        passed: parseInt(attrs.passed) || 0,
        failed: parseInt(attrs.failed) || 0,
        skipped: parseInt(attrs.skipped) || 0,
        time: parseFloat(attrs.time) || 0,
        runDate: attrs['run-date'] || '',
        runTime: attrs['run-time'] || '',
        errors: attrs.errors ? parseInt(attrs.errors) : undefined,
        collections,
      } as TestAssembly;
    });

    return assemblies;
  } catch (error) {
    console.error('Error parsing test results:', error);
    return null;
  }
}

/**
 * Get a summary of test results
 */
export async function getTestResultsSummary(): Promise<{
  totalTests: number;
  passed: number;
  failed: number;
  skipped: number;
  totalTime: number;
  runDate: string;
  runTime: string;
  failedTests: Array<{ codeunit: string; test: string; message: string; stackTrace: string }>;
} | null> {
  const assemblies = await parseTestResults();
  
  if (!assemblies || assemblies.length === 0) {
    return null;
  }

  let totalTests = 0;
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let totalTime = 0;
  const failedTests: Array<{ codeunit: string; test: string; message: string; stackTrace: string }> = [];

  for (const assembly of assemblies) {
    totalTests += assembly.total;
    passed += assembly.passed;
    failed += assembly.failed;
    skipped += assembly.skipped;
    totalTime += assembly.time;

    for (const collection of assembly.collections) {
      for (const test of collection.tests) {
        if (test.result === 'Fail' && test.failure) {
          failedTests.push({
            codeunit: assembly.name,
            test: test.method,
            message: test.failure.message,
            stackTrace: test.failure.stackTrace,
          });
        }
      }
    }
  }

  return {
    totalTests,
    passed,
    failed,
    skipped,
    totalTime,
    runDate: assemblies[0].runDate,
    runTime: assemblies[0].runTime,
    failedTests,
  };
}

/**
 * Parse code coverage JSON file
 */
export function parseCodeCoverage(): CodeCoverageLine[] | null {
  const coveragePath = getCodeCoveragePath();
  
  if (!existsSync(coveragePath)) {
    return null;
  }

  try {
    const data = readFileSync(coveragePath, 'utf-8');
    const coverage = JSON.parse(data) as Array<{
      ObjectType: string;
      ObjectID: string;
      LineType: string;
      LineNo: string;
      NoOfHits: string;
    }>;

    return coverage.map(line => ({
      objectType: line.ObjectType,
      objectId: line.ObjectID,
      lineType: line.LineType,
      lineNo: line.LineNo,
      noOfHits: line.NoOfHits,
    }));
  } catch (error) {
    console.error('Error parsing code coverage:', error);
    return null;
  }
}

/**
 * Get code coverage summary
 */
export function getCodeCoverageSummary(
  objectType?: string, 
  objectId?: number
): CodeCoverageSummary | null {
  const coverage = parseCodeCoverage();
  
  if (!coverage) {
    return null;
  }

  // Filter to code lines only
  let codeLines = coverage.filter(line => line.lineType === 'Code');

  // Apply filters if provided
  if (objectType) {
    codeLines = codeLines.filter(line => 
      line.objectType.toLowerCase() === objectType.toLowerCase()
    );
  }
  if (objectId !== undefined) {
    codeLines = codeLines.filter(line => 
      parseInt(line.objectId) === objectId
    );
  }

  // Group by object
  const objectMap = new Map<string, { lines: CodeCoverageLine[]; type: string; id: number }>();
  
  for (const line of codeLines) {
    const key = `${line.objectType}-${line.objectId}`;
    if (!objectMap.has(key)) {
      objectMap.set(key, {
        lines: [],
        type: line.objectType,
        id: parseInt(line.objectId),
      });
    }
    objectMap.get(key)!.lines.push(line);
  }

  // Calculate coverage per object
  const objects: ObjectCoverage[] = [];
  let totalLines = 0;
  let coveredLines = 0;

  for (const [, obj] of objectMap) {
    const objTotalLines = obj.lines.length;
    const objCoveredLines = obj.lines.filter(l => parseInt(l.noOfHits) > 0).length;
    
    totalLines += objTotalLines;
    coveredLines += objCoveredLines;

    objects.push({
      objectType: obj.type,
      objectId: obj.id,
      totalLines: objTotalLines,
      coveredLines: objCoveredLines,
      coveragePercentage: objTotalLines > 0 
        ? Math.round((objCoveredLines / objTotalLines) * 100) 
        : 0,
    });
  }

  return {
    totalLines,
    coveredLines,
    coveragePercentage: totalLines > 0 
      ? Math.round((coveredLines / totalLines) * 100) 
      : 0,
    objects: objects.sort((a, b) => a.objectId - b.objectId),
  };
}

