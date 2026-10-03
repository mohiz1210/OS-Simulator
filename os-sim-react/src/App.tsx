import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, StepForward, Cpu, Clock, Activity, MemoryStick, Settings, RotateCcw, TerminalSquare, Lock } from 'lucide-react';

type ProcessState = 'NEW' | 'READY' | 'RUNNING' | 'WAITING' | 'TERMINATED';
type ThreadState = 'NEW' | 'READY' | 'RUNNING' | 'WAITING' | 'TERMINATED';
type SchedulerType = 'RR' | 'FCFS' | 'PRIORITY';

type InstructionType = 'COMPUTE' | 'MUTEX_LOCK' | 'MUTEX_UNLOCK' | 'SEM_WAIT' | 'SEM_SIGNAL' | 'LOAD_VAR' | 'STORE_VAR' | 'LOCAL_INC' | 'VAR_INC' | 'VAR_DEC' | 'IO_WAIT';

interface ThreadInstruction {
  type: InstructionType;
  ticks?: number;
  targetId?: string;
  name?: string;
}

interface GanttBlock {
  tid: string | null;
  pid: number | null;
  startTick: number;
  endTick: number;
}

interface CPUContext {
  pc: string;
  sp: string;
  r1: string;
  r2: string;
}

interface PageTableEntry {
  pageId: number;
  frameId: number | null;
  valid: boolean;
  loadTime: number;
  lastAccessTime: number;
}

interface Thread {
  tid: string;
  pid: number;
  state: ThreadState;
  burstTime: number;
  remainingTime: number;
  context: CPUContext;
  waitingForTid: string | null;
  ioWaitTime: number;
  queueTime: number;
  colorClass: string;
  localReg: number;
  waitingForMutex: string | null;
  waitingForSem: string | null;
  instructions: ThreadInstruction[];
  pageFaultWaitTime: number;
  faultingPage: number | null;
}

interface Process {
  id: number;
  name: string;
  priority: number;
  memoryRequired: number;
  memoryBlocks: number[];
  threads: Thread[];
  state: ProcessState;
  arrivalTime: number;
  completionTime: number | null;
  colorClass: string;
  agingCounter?: number;
  pageTable: PageTableEntry[];
  pageFaults: number;
  pageHits: number;
}

interface SimMutex {
  id: string;
  name: string;
  isLocked: boolean;
  ownerTid: string | null;
  waitQueue: string[];
}

interface SimSemaphore {
  id: string;
  name: string;
  counter: number;
  waitQueue: string[];
}

interface SharedVar {
  id: string;
  name: string;
  value: number;
}

interface LogEntry {
  tick: number;
  msg: string;
}

const COLORS = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 
  'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 
  'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500', 
  'bg-pink-500', 'bg-rose-500'
];

export default function App() {
  const [totalMemory, setTotalMemory] = useState(64);
  const [processes, setProcesses] = useState<Process[]>([]);
  const processesRef = useRef<Process[]>([]);
  const [memory, setMemory] = useState<(number | null)[]>(Array(64).fill(null));
  const memoryRef = useRef<(number | null)[]>(Array(64).fill(null));
  const [clock, setClock] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [ganttChart, setGanttChart] = useState<GanttBlock[]>([]);
  const ganttContainerRef = useRef<HTMLDivElement>(null);
  
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsRef = useRef<LogEntry[]>([]);

  // Sync Primitives
  const [mutexes, setMutexes] = useState<SimMutex[]>([]);
  const mutexesRef = useRef<SimMutex[]>([]);
  const [semaphores, setSemaphores] = useState<SimSemaphore[]>([]);
  const semaphoresRef = useRef<SimSemaphore[]>([]);
  const [sharedVars, setSharedVars] = useState<SharedVar[]>([]);
  const sharedVarsRef = useRef<SharedVar[]>([]);

  // OS Settings
  const [schedulerType, setSchedulerType] = useState<SchedulerType>('RR');
  const [quantum, setQuantum] = useState(3);
  const [pageReplacement, setPageReplacement] = useState<'LRU' | 'FIFO'>('LRU');
  const [useDemandPaging, setUseDemandPaging] = useState(true);
  
  // Process Form
  const [newBurst, setNewBurst] = useState(5);
  const [newMem, setNewMem] = useState(4);
  const [newPriority, setNewPriority] = useState(5);
  const [newArrival, setNewArrival] = useState(0);

  const currentQuantum = useRef(0);
  const nextProcessId = useRef(1);
  const nextQueueCounter = useRef(1);
  const clockRef = useRef(0);
  
  const busyTicks = useRef(0);
  const contextSwitches = useRef(0);
  const totalPageFaultsRef = useRef(0);
  const totalPageHitsRef = useRef(0);

  const tick = () => {
    const currentTick = clockRef.current;
    clockRef.current += 1;
    setClock(clockRef.current);

    let procs: Process[] = JSON.parse(JSON.stringify(processesRef.current));
    let nextMem = [...memoryRef.current];
    let nextLogs = [...logsRef.current];
    let nextMutexes: SimMutex[] = JSON.parse(JSON.stringify(mutexesRef.current));
    let nextSemaphores: SimSemaphore[] = JSON.parse(JSON.stringify(semaphoresRef.current));
    let nextVars: SharedVar[] = JSON.parse(JSON.stringify(sharedVarsRef.current));

    const logMsg = (msg: string) => {
      nextLogs.unshift({ tick: currentTick, msg });
      if (nextLogs.length > 300) nextLogs.pop();
    };

    // 1. Memory Allocation for NEW processes
    procs.forEach((p) => {
      if (p.state === 'NEW' && currentTick >= p.arrivalTime) {
        if (useDemandPaging) {
          // DEMAND PAGING: Do not allocate all frames immediately.
          p.state = 'READY';
          p.threads.forEach(t => {
            if (t.state === 'NEW') {
              t.state = 'READY';
              t.queueTime = nextQueueCounter.current++;
            }
          });
          logMsg(`[PID ${p.id}] PCB created. Pages loaded into Swap (Demand Paging).`);
        } else {
          // CONTIGUOUS ALLOCATION
          let freeFrames: number[] = [];
          for (let i = 0; i < nextMem.length; i++) {
            if (nextMem[i] === null) freeFrames.push(i);
            if (freeFrames.length === p.memoryRequired) break;
          }
          if (freeFrames.length === p.memoryRequired) {
            freeFrames.forEach((frameIdx, i) => {
              nextMem[frameIdx] = p.id;
              p.pageTable[i].valid = true;
              p.pageTable[i].frameId = frameIdx;
              p.pageTable[i].loadTime = currentTick;
            });
            p.state = 'READY';
            p.threads.forEach(t => {
              if (t.state === 'NEW') {
                t.state = 'READY';
                t.queueTime = nextQueueCounter.current++;
              }
            });
            logMsg(`[PID ${p.id}] PCB created. Allocated ${p.memoryRequired} contiguous frames.`);
          } else {
            if (p.agingCounter === 0) {
              logMsg(`[PID ${p.id}] Not enough memory for Contiguous Allocation. Waiting...`);
              p.agingCounter = 1;
            }
          }
        }
      }
    });

    // 2. I/O and Sync (WAITING threads)
    procs.forEach(p => {
      p.threads.forEach(t => {
        if (t.state === 'WAITING') {
          if (t.pageFaultWaitTime > 0) {
            t.pageFaultWaitTime -= 1;
            if (t.pageFaultWaitTime === 0 && t.faultingPage !== null) {
              const pte = p.pageTable[t.faultingPage];
              
              let freeFrame = nextMem.findIndex(m => m === null);
              
              if (freeFrame === -1) {
                // PAGE REPLACEMENT
                let allPTEs: {pId: number, pageId: number, frameId: number, loadTime: number, lastAccess: number}[] = [];
                procs.forEach(px => {
                  px.pageTable.forEach(pxte => {
                    if (pxte.valid && pxte.frameId !== null) {
                      allPTEs.push({pId: px.id, pageId: pxte.pageId, frameId: pxte.frameId, loadTime: pxte.loadTime, lastAccess: pxte.lastAccessTime});
                    }
                  });
                });

                if (pageReplacement === 'FIFO') {
                  allPTEs.sort((a, b) => a.loadTime - b.loadTime);
                } else {
                  allPTEs.sort((a, b) => a.lastAccess - b.lastAccess);
                }
                
                const victim = allPTEs[0];
                if (victim) {
                  freeFrame = victim.frameId;
                  const victimProc = procs.find(px => px.id === victim.pId);
                  if (victimProc) {
                    victimProc.pageTable[victim.pageId].valid = false;
                    victimProc.pageTable[victim.pageId].frameId = null;
                  }
                  logMsg(`[System] SWAPPED OUT: PID ${victim.pId} Page ${victim.pageId} removed from Frame ${freeFrame} (Policy: ${pageReplacement})`);
                }
              }

              if (freeFrame !== -1) {
                pte.valid = true;
                pte.frameId = freeFrame;
                pte.loadTime = currentTick;
                nextMem[freeFrame] = p.id;
                logMsg(`[${t.tid}] SWAPPED IN: Page ${t.faultingPage} loaded into Frame ${freeFrame}. Thread is READY.`);
              }
              
              t.state = 'READY';
              t.queueTime = nextQueueCounter.current++;
              t.faultingPage = null;
            }
          } else if (t.ioWaitTime > 0) {
            t.ioWaitTime -= 1;
            if (t.ioWaitTime === 0) {
              t.state = 'READY';
              t.queueTime = nextQueueCounter.current++;
              logMsg(`[${t.tid}] Finished I/O, transitioned to READY.`);
            }
          } else if (t.waitingForTid) {
            const targetProc = procs.find(px => px.threads.some(tx => tx.tid === t.waitingForTid));
            const targetThread = targetProc?.threads.find(tx => tx.tid === t.waitingForTid);
            if (!targetThread || targetThread.state === 'TERMINATED') {
              logMsg(`[${t.tid}] Successfully joined ${t.waitingForTid}, transitioned to READY.`);
              t.waitingForTid = null;
              t.state = 'READY';
              t.queueTime = nextQueueCounter.current++;
            }
          }
        }
      });
    });

    // Priority Aging
    if (schedulerType === 'PRIORITY') {
      procs.forEach(p => {
        if (p.state !== 'NEW' && p.state !== 'TERMINATED') {
          const hasReady = p.threads.some(t => t.state === 'READY');
          const hasRunning = p.threads.some(t => t.state === 'RUNNING');
          if (hasReady && !hasRunning) {
            p.agingCounter = (p.agingCounter || 0) + 1;
            if (p.agingCounter >= 10 && p.priority > 1) {
              p.priority -= 1;
              p.agingCounter = 0;
              logMsg(`[PID ${p.id}] Priority aged (boosted) to ${p.priority} to prevent starvation.`);
            }
          } else {
            p.agingCounter = 0;
          }
        }
      });
    }

    // 3. CPU Scheduling (RUNNING thread)
    let runningThread: Thread | null = null;
    let runningProc: Process | null = null;
    
    for (let p of procs) {
      const t = p.threads.find(th => th.state === 'RUNNING');
      if (t) {
        runningThread = t;
        runningProc = p;
        break;
      }
    }

    let preempt = false;
    let blockedThisTick = false;

    if (runningThread && runningProc) {
      busyTicks.current += 1;
      currentQuantum.current += 1;

      // Simulate Hardware Context Execution
      const pcVal = parseInt(runningThread.context.pc, 16) + 4;
      runningThread.context.pc = '0x' + pcVal.toString(16).toUpperCase().padStart(4, '0');
      runningThread.context.r1 = '0x' + runningThread.localReg.toString(16).toUpperCase().padStart(4, '0');

      // Memory Access
      let pageFaultOccurred = false;
      if (useDemandPaging && runningProc.memoryRequired > 0) {
        const pageToAccess = Math.floor(Math.random() * runningProc.memoryRequired);
        const pte = runningProc.pageTable[pageToAccess];
        pte.lastAccessTime = currentTick;

        if (!pte.valid) {
          totalPageFaultsRef.current += 1;
          runningProc.pageFaults += 1;
          logMsg(`[${runningThread.tid}] PAGE FAULT on Page ${pageToAccess}. Blocking for Disk I/O.`);
          runningThread.state = 'WAITING';
          runningThread.pageFaultWaitTime = 3;
          runningThread.faultingPage = pageToAccess;
          blockedThisTick = true;
          pageFaultOccurred = true;
        } else {
          totalPageHitsRef.current += 1;
          runningProc.pageHits += 1;
        }
      }

      if (!pageFaultOccurred) {
        if (runningThread.instructions && runningThread.instructions.length > 0) {
        const inst = runningThread.instructions[0];
        
        switch (inst.type) {
          case 'COMPUTE':
            if (inst.ticks && inst.ticks > 0) {
              inst.ticks -= 1;
              runningThread.remainingTime -= 1;
              if (inst.ticks <= 0) runningThread.instructions.shift();
            }
            break;
          case 'MUTEX_LOCK': {
            const m = nextMutexes.find(x => x.id === inst.targetId);
            if (m) {
              if (m.isLocked && m.ownerTid !== runningThread.tid) {
                runningThread.state = 'WAITING';
                runningThread.waitingForMutex = m.id;
                m.waitQueue.push(runningThread.tid);
                logMsg(`[${runningThread.tid}] BLOCKED waiting for Mutex: ${m.name}`);
                blockedThisTick = true;
              } else {
                m.isLocked = true;
                m.ownerTid = runningThread.tid;
                logMsg(`[${runningThread.tid}] Acquired Mutex: ${m.name}`);
                runningThread.instructions.shift();
              }
            } else runningThread.instructions.shift();
            break;
          }
          case 'MUTEX_UNLOCK': {
            const m = nextMutexes.find(x => x.id === inst.targetId);
            if (m && m.ownerTid === runningThread.tid) {
              m.isLocked = false;
              m.ownerTid = null;
              logMsg(`[${runningThread.tid}] Released Mutex: ${m.name}`);
              
              if (m.waitQueue.length > 0) {
                const wTid = m.waitQueue.shift()!;
                procs.forEach(px => px.threads.forEach(tx => {
                  if (tx.tid === wTid) {
                    tx.state = 'READY';
                    tx.waitingForMutex = null;
                    tx.queueTime = nextQueueCounter.current++;
                    logMsg(`[${tx.tid}] Awoken by Mutex: ${m.name}`);
                  }
                }));
              }
            }
            runningThread.instructions.shift();
            break;
          }
          case 'SEM_WAIT': {
            const s = nextSemaphores.find(x => x.id === inst.targetId);
            if (s) {
              if (s.counter > 0) {
                s.counter -= 1;
                logMsg(`[${runningThread.tid}] Passed Sem Wait: ${s.name} (Count: ${s.counter})`);
                runningThread.instructions.shift();
              } else {
                runningThread.state = 'WAITING';
                runningThread.waitingForSem = s.id;
                s.waitQueue.push(runningThread.tid);
                logMsg(`[${runningThread.tid}] BLOCKED on Sem: ${s.name}`);
                blockedThisTick = true;
              }
            } else runningThread.instructions.shift();
            break;
          }
          case 'SEM_SIGNAL': {
            const s = nextSemaphores.find(x => x.id === inst.targetId);
            if (s) {
              s.counter += 1;
              logMsg(`[${runningThread.tid}] Signaled Sem: ${s.name} (Count: ${s.counter})`);
              
              if (s.waitQueue.length > 0) {
                const wTid = s.waitQueue.shift()!;
                procs.forEach(px => px.threads.forEach(tx => {
                  if (tx.tid === wTid) {
                    tx.state = 'READY';
                    tx.waitingForSem = null;
                    tx.queueTime = nextQueueCounter.current++;
                    logMsg(`[${tx.tid}] Awoken by Sem: ${s.name}`);
                  }
                }));
              }
            }
            runningThread.instructions.shift();
            break;
          }
          case 'LOAD_VAR': {
            const v = nextVars.find(x => x.id === inst.targetId);
            if (v) runningThread.localReg = v.value;
            logMsg(`[${runningThread.tid}] Loaded ${v?.name} into Reg -> ${runningThread.localReg}`);
            runningThread.instructions.shift();
            break;
          }
          case 'STORE_VAR': {
            const v = nextVars.find(x => x.id === inst.targetId);
            if (v) {
               v.value = runningThread.localReg;
               logMsg(`[${runningThread.tid}] Stored Reg to ${v.name} -> ${v.value}`);
            }
            runningThread.instructions.shift();
            break;
          }
          case 'LOCAL_INC': {
            runningThread.localReg += 1;
            runningThread.instructions.shift();
            break;
          }
          case 'VAR_INC': {
            const v = nextVars.find(x => x.id === inst.targetId);
            if (v) { v.value += 1; logMsg(`[${runningThread.tid}] Incremented ${v.name} -> ${v.value}`); }
            runningThread.instructions.shift();
            break;
          }
          case 'VAR_DEC': {
            const v = nextVars.find(x => x.id === inst.targetId);
            if (v) { v.value -= 1; logMsg(`[${runningThread.tid}] Decremented ${v.name} -> ${v.value}`); }
            runningThread.instructions.shift();
            break;
          }
          case 'IO_WAIT': {
            runningThread.state = 'WAITING';
            runningThread.ioWaitTime = inst.ticks || 5;
            logMsg(`[${runningThread.tid}] Auto-triggered I/O request. Blocking for ${runningThread.ioWaitTime} ticks.`);
            runningThread.instructions.shift();
            blockedThisTick = true;
            break;
          }
        }
      } else {
         runningThread.remainingTime -= 1;
      }
      } // End of pageFaultOccurred else block

      if (runningThread.remainingTime <= 0 && (!runningThread.instructions || runningThread.instructions.length === 0)) {
        runningThread.state = 'TERMINATED';
        logMsg(`[${runningThread.tid}] Execution finished, state is TERMINATED.`);
      } else if (!blockedThisTick) {
        if (schedulerType === 'RR' && currentQuantum.current >= quantum) {
          preempt = true;
        } else if (schedulerType === 'PRIORITY') {
          let highestReadyThread: Thread | null = null;
          let highestReadyPriority = Infinity;
          
          procs.forEach(p => {
            if (p.state !== 'NEW') {
              p.threads.forEach(t => {
                if (t.state === 'READY') {
                  if (p.priority < highestReadyPriority) {
                    highestReadyPriority = p.priority;
                    highestReadyThread = t;
                  }
                }
              });
            }
          });
          
          if (highestReadyThread && highestReadyPriority < runningProc.priority) {
            preempt = true;
          }
        }

        if (preempt && runningThread.state === 'RUNNING') {
          runningThread.state = 'READY';
          runningThread.queueTime = nextQueueCounter.current++;
          logMsg(`[${runningThread.tid}] Preempted and moved back to READY queue.`);
        }
      }
    }

    // Update Process states based on threads BEFORE dispatch
    procs.forEach(p => {
      if (p.state !== 'NEW' && p.state !== 'TERMINATED') {
        const allTerminated = p.threads.every(t => t.state === 'TERMINATED');
        if (allTerminated) {
          p.state = 'TERMINATED';
          p.completionTime = currentTick;
          p.pageTable.forEach(pte => {
            if (pte.valid && pte.frameId !== null) {
              nextMem[pte.frameId] = null;
            }
          });
          p.pageTable = [];
          p.memoryBlocks = [];
          logMsg(`[PID ${p.id}] All threads terminated. Memory frames released.`);
        } else {
          const hasRunning = p.threads.some(t => t.state === 'RUNNING');
          const hasReady = p.threads.some(t => t.state === 'READY');
          if (hasRunning) p.state = 'RUNNING';
          else if (hasReady) p.state = 'READY';
          else p.state = 'WAITING';
        }
      }
    });

    // 4. Dispatch next thread if CPU is idle
    const isCpuIdle = !procs.some(p => p.threads.some(t => t.state === 'RUNNING'));
    if (isCpuIdle) {
      let readyList: {t: Thread, p: Process}[] = [];
      procs.forEach(p => {
        if (p.state !== 'NEW') {
          p.threads.forEach(t => {
            if (t.state === 'READY') {
              readyList.push({t, p});
            }
          });
        }
      });
      
      if (readyList.length > 0) {
        if (schedulerType === 'PRIORITY') {
          readyList.sort((a, b) => a.p.priority - b.p.priority || a.t.queueTime - b.t.queueTime);
        } else {
          readyList.sort((a, b) => a.t.queueTime - b.t.queueTime);
        }
        
        const nextThread = readyList[0].t;
        const nextProc = readyList[0].p;
        
        if (runningThread?.tid !== nextThread.tid) {
           logMsg(`[CPU] process_context_switch(${runningThread?.tid || 'IDLE'}, ${nextThread.tid}) invoked. Saving context.`);
           contextSwitches.current += 1;
        }
        
        nextThread.state = 'RUNNING';
        nextProc.state = 'RUNNING';
        currentQuantum.current = 0;
      }
    }

    // Update Gantt Chart
    let activeTid = null;
    let activePid = null;
    const currRunningProc = procs.find(p => p.threads.some(t => t.state === 'RUNNING'));
    if (currRunningProc) {
      activePid = currRunningProc.id;
      activeTid = currRunningProc.threads.find(t => t.state === 'RUNNING')!.tid;
    }

    const allDone = procs.length > 0 && procs.every(p => p.state === 'TERMINATED');

    if (!allDone || activeTid !== null) {
      setGanttChart(prevGantt => {
        const nextGantt = [...prevGantt];
        if (nextGantt.length === 0) {
          nextGantt.push({ tid: activeTid, pid: activePid, startTick: currentTick, endTick: clockRef.current });
        } else {
          const lastBlock = nextGantt[nextGantt.length - 1];
          if (lastBlock.tid === activeTid) {
            lastBlock.endTick = clockRef.current;
          } else {
            nextGantt.push({ tid: activeTid, pid: activePid, startTick: currentTick, endTick: clockRef.current });
          }
        }
        return nextGantt;
      });
    }

    if (allDone) {
      setTimeout(() => setIsRunning(false), 0);
    }

    memoryRef.current = nextMem;
    setMemory(nextMem);
    processesRef.current = procs;
    setProcesses(procs);
    logsRef.current = nextLogs;
    setLogs(nextLogs);
    mutexesRef.current = nextMutexes;
    setMutexes(nextMutexes);
    semaphoresRef.current = nextSemaphores;
    setSemaphores(nextSemaphores);
    sharedVarsRef.current = nextVars;
    setSharedVars(nextVars);
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRunning) {
      interval = setInterval(() => {
        tick();
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, schedulerType, quantum]);

  useEffect(() => {
    if (ganttContainerRef.current) {
      ganttContainerRef.current.scrollLeft = ganttContainerRef.current.scrollWidth;
    }
  }, [ganttChart]);

  const createThreadObj = (pid: number, tid: number, burst: number, inst: ThreadInstruction[] = []): Thread => ({
    tid: `P${pid}-T${tid}`,
    pid, state: 'NEW', burstTime: burst, remainingTime: burst,
    context: {
      pc: '0x' + Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0'),
      sp: '0x' + Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0'),
      r1: '0x0000', r2: '0x0000'
    },
    waitingForTid: null, ioWaitTime: 0, queueTime: 0,
    colorClass: COLORS[(pid-1) % COLORS.length], localReg: 0,
    waitingForMutex: null, waitingForSem: null, instructions: inst,
    pageFaultWaitTime: 0, faultingPage: null
  });

  const handleAddProcess = (e: React.FormEvent) => {
    e.preventDefault();
    const color = COLORS[nextProcessId.current % COLORS.length];
    const newProc: Process = {
      id: nextProcessId.current, name: `Process ${nextProcessId.current}`, priority: newPriority,
      memoryRequired: newMem, memoryBlocks: [],
      threads: [createThreadObj(nextProcessId.current, 1, newBurst)],
      state: 'NEW', arrivalTime: newArrival, completionTime: null, colorClass: color, agingCounter: 0,
      pageTable: Array.from({ length: newMem }).map((_, i) => ({ pageId: i, frameId: null, valid: false, loadTime: 0, lastAccessTime: 0 })),
      pageFaults: 0, pageHits: 0
    };
    nextProcessId.current++;
    const nextProcs = [...processesRef.current, newProc];
    processesRef.current = nextProcs;
    setProcesses(nextProcs);
    logsRef.current.unshift({ tick: clockRef.current, msg: `[Kernel] process_create() for PID ${newProc.id} called.` });
    setLogs([...logsRef.current]);
  };

  const handleAddThread = (pid: number) => {
    const burst = parseInt(prompt('Enter burst time for new thread:') || '5');
    if (!burst) return;
    const procs = processesRef.current.map(p => {
      if (p.id === pid) {
        const nextTid = p.threads.length + 1;
        const newThread = createThreadObj(p.id, nextTid, burst);
        newThread.state = p.state === 'NEW' ? 'NEW' : 'READY';
        newThread.queueTime = nextQueueCounter.current++;
        logsRef.current.unshift({ tick: clockRef.current, msg: `[Kernel] thread_create() spawned ${newThread.tid} under PID ${pid}` });
        return { ...p, threads: [...p.threads, newThread] };
      }
      return p;
    });
    processesRef.current = procs;
    setProcesses(procs);
    setLogs([...logsRef.current]);
  };

  const handleTriggerIO = (tid: string) => {
    const procs = processesRef.current.map(p => ({
      ...p,
      threads: p.threads.map(t => {
        if (t.tid === tid) {
          logsRef.current.unshift({ tick: clockRef.current, msg: `[${t.tid}] Initiated I/O Block (WAITING)` });
          return { ...t, state: 'WAITING', ioWaitTime: 5 };
        }
        return t;
      })
    }));
    processesRef.current = procs;
    setProcesses(procs);
    setLogs([...logsRef.current]);
  };

  const handleThreadJoin = (callerTid: string) => {
    const target = prompt('Enter Thread ID to join (e.g. P1-T1):');
    if (!target) return;
    const procs = processesRef.current.map(p => ({
      ...p,
      threads: p.threads.map(t => {
        if (t.tid === callerTid) {
          logsRef.current.unshift({ tick: clockRef.current, msg: `[Kernel] thread_join(): ${t.tid} is WAITING for ${target} to terminate` });
          return { ...t, state: 'WAITING', waitingForTid: target };
        }
        return t;
      })
    }));
    processesRef.current = procs;
    setProcesses(procs);
    setLogs([...logsRef.current]);
  };

  const loadDemo = (demo: string) => {
    handleReset(64);
    setSchedulerType('RR');
    setQuantum(2);

    let procs: Process[] = [];
    let muts: SimMutex[] = [];
    let sems: SimSemaphore[] = [];
    let vars: SharedVar[] = [];

    if (demo === 'race') {
      vars.push({ id: 'v1', name: 'Shared Counter', value: 0 });
      const inst = [
        { type: 'LOAD_VAR', targetId: 'v1', name: 'Counter' } as ThreadInstruction,
        { type: 'COMPUTE', ticks: 1 },
        { type: 'LOCAL_INC' },
        { type: 'COMPUTE', ticks: 1 },
        { type: 'STORE_VAR', targetId: 'v1', name: 'Counter' }
      ];
      procs.push({
        id: 1, name: 'Process A', priority: 5, memoryRequired: 4, memoryBlocks: [0,1,2,3],
        threads: [{...createThreadObj(1, 1, 4, [...inst, ...inst]), state: 'READY'}],
        state: 'READY', arrivalTime: 0, completionTime: null, colorClass: COLORS[0], agingCounter: 0
      });
      procs.push({
        id: 2, name: 'Process B', priority: 5, memoryRequired: 4, memoryBlocks: [4,5,6,7],
        threads: [{...createThreadObj(2, 1, 4, [...inst, ...inst]), state: 'READY'}],
        state: 'READY', arrivalTime: 0, completionTime: null, colorClass: COLORS[1], agingCounter: 0
      });
    } 
    else if (demo === 'mutex') {
      vars.push({ id: 'v1', name: 'Shared Counter', value: 0 });
      muts.push({ id: 'm1', name: 'Counter Lock', isLocked: false, ownerTid: null, waitQueue: [] });
      const inst = [
        { type: 'MUTEX_LOCK', targetId: 'm1', name: 'Counter Lock' } as ThreadInstruction,
        { type: 'LOAD_VAR', targetId: 'v1', name: 'Counter' },
        { type: 'COMPUTE', ticks: 1 },
        { type: 'LOCAL_INC' },
        { type: 'COMPUTE', ticks: 1 },
        { type: 'STORE_VAR', targetId: 'v1', name: 'Counter' },
        { type: 'MUTEX_UNLOCK', targetId: 'm1', name: 'Counter Lock' }
      ];
      procs.push({
        id: 1, name: 'Process A', priority: 5, memoryRequired: 4, memoryBlocks: [0,1,2,3],
        threads: [{...createThreadObj(1, 1, 4, [...inst, ...inst]), state: 'READY'}],
        state: 'READY', arrivalTime: 0, completionTime: null, colorClass: COLORS[0], agingCounter: 0
      });
      procs.push({
        id: 2, name: 'Process B', priority: 5, memoryRequired: 4, memoryBlocks: [4,5,6,7],
        threads: [{...createThreadObj(2, 1, 4, [...inst, ...inst]), state: 'READY'}],
        state: 'READY', arrivalTime: 0, completionTime: null, colorClass: COLORS[1], agingCounter: 0
      });
    }
    else if (demo === 'prod_cons') {
      vars.push({ id: 'buffer', name: 'Items in Buffer', value: 0 });
      sems.push({ id: 'empty', name: 'Empty Slots', counter: 3, waitQueue: [] });
      sems.push({ id: 'full', name: 'Filled Slots', counter: 0, waitQueue: [] });
      muts.push({ id: 'm1', name: 'Buffer Mutex', isLocked: false, ownerTid: null, waitQueue: [] });

      const prodInst = [
        { type: 'COMPUTE', ticks: 1 } as ThreadInstruction,
        { type: 'SEM_WAIT', targetId: 'empty', name: 'Empty Slots' },
        { type: 'MUTEX_LOCK', targetId: 'm1', name: 'Buffer Mutex' },
        { type: 'VAR_INC', targetId: 'buffer', name: 'Items in Buffer' },
        { type: 'MUTEX_UNLOCK', targetId: 'm1', name: 'Buffer Mutex' },
        { type: 'SEM_SIGNAL', targetId: 'full', name: 'Filled Slots' }
      ];
      const consInst = [
        { type: 'SEM_WAIT', targetId: 'full', name: 'Filled Slots' } as ThreadInstruction,
        { type: 'MUTEX_LOCK', targetId: 'm1', name: 'Buffer Mutex' },
        { type: 'VAR_DEC', targetId: 'buffer', name: 'Items in Buffer' },
        { type: 'MUTEX_UNLOCK', targetId: 'm1', name: 'Buffer Mutex' },
        { type: 'SEM_SIGNAL', targetId: 'empty', name: 'Empty Slots' },
        { type: 'COMPUTE', ticks: 1 }
      ];
      procs.push({
        id: 1, name: 'Producer', priority: 5, memoryRequired: 4, memoryBlocks: [0,1,2,3],
        threads: [{...createThreadObj(1, 1, 3, [...prodInst, ...prodInst, ...prodInst]), state: 'READY'}],
        state: 'READY', arrivalTime: 0, completionTime: null, colorClass: COLORS[3], agingCounter: 0
      });
      procs.push({
        id: 2, name: 'Consumer', priority: 5, memoryRequired: 4, memoryBlocks: [4,5,6,7],
        threads: [{...createThreadObj(2, 1, 3, [...consInst, ...consInst, ...consInst]), state: 'READY'}],
        state: 'READY', arrivalTime: 0, completionTime: null, colorClass: COLORS[4], agingCounter: 0
      });
      setQuantum(3);
    }

    const newMem = Array(64).fill(null);
    procs.forEach(p => p.memoryBlocks.forEach(b => newMem[b] = p.id));
    
    procs.forEach(p => {
      p.pageTable = Array.from({ length: p.memoryRequired }).map((_, i) => ({
        pageId: i, frameId: p.memoryBlocks[i] ?? null, valid: p.memoryBlocks[i] !== undefined, loadTime: 0, lastAccessTime: 0
      }));
      p.pageFaults = 0;
      p.pageHits = 0;
    });

    processesRef.current = procs; setProcesses(procs);
    mutexesRef.current = muts; setMutexes(muts);
    semaphoresRef.current = sems; setSemaphores(sems);
    sharedVarsRef.current = vars; setSharedVars(vars);
    
    memoryRef.current = newMem; setMemory(newMem);
    nextProcessId.current = procs.length + 1;
    
    logsRef.current.unshift({ tick: 0, msg: `[System] Loaded Synchronization Demo: ${demo}` });
    setLogs([...logsRef.current]);
  };

  const loadWorkload = (type: string) => {
    handleReset(64);
    setSchedulerType('RR');
    setQuantum(3);

    let procs: Process[] = [];

    if (type === 'cpu') {
      for (let i = 1; i <= 3; i++) {
        const inst = [{ type: 'COMPUTE', ticks: 15 } as ThreadInstruction];
        procs.push({
          id: i, name: `CPU-Heavy ${i}`, priority: 3, memoryRequired: 4, memoryBlocks: [(i-1)*4, (i-1)*4+1, (i-1)*4+2, (i-1)*4+3],
          threads: [{...createThreadObj(i, 1, 15, inst), state: 'READY'}],
          state: 'READY', arrivalTime: 0, completionTime: null, colorClass: COLORS[i], agingCounter: 0
        });
      }
    } else if (type === 'io') {
      for (let i = 1; i <= 3; i++) {
        const inst: ThreadInstruction[] = [
          { type: 'COMPUTE', ticks: 1 }, { type: 'IO_WAIT', ticks: 4 },
          { type: 'COMPUTE', ticks: 1 }, { type: 'IO_WAIT', ticks: 4 },
          { type: 'COMPUTE', ticks: 1 }, { type: 'IO_WAIT', ticks: 4 }
        ];
        procs.push({
          id: i, name: `IO-Heavy ${i}`, priority: 3, memoryRequired: 2, memoryBlocks: [(i-1)*2, (i-1)*2+1],
          threads: [{...createThreadObj(i, 1, 3, inst), state: 'READY'}],
          state: 'READY', arrivalTime: 0, completionTime: null, colorClass: COLORS[i+3], agingCounter: 0
        });
      }
    } else if (type === 'mixed') {
      const cpuInst = [{ type: 'COMPUTE', ticks: 15 } as ThreadInstruction];
      const ioInst: ThreadInstruction[] = [
        { type: 'COMPUTE', ticks: 1 }, { type: 'IO_WAIT', ticks: 5 },
        { type: 'COMPUTE', ticks: 1 }, { type: 'IO_WAIT', ticks: 5 }
      ];
      procs.push({
        id: 1, name: 'CPU-Bound', priority: 3, memoryRequired: 4, memoryBlocks: [0,1,2,3],
        threads: [{...createThreadObj(1, 1, 15, cpuInst), state: 'READY'}],
        state: 'READY', arrivalTime: 0, completionTime: null, colorClass: COLORS[0], agingCounter: 0
      });
      procs.push({
        id: 2, name: 'IO-Bound', priority: 3, memoryRequired: 2, memoryBlocks: [4,5],
        threads: [{...createThreadObj(2, 1, 2, ioInst), state: 'READY'}],
        state: 'READY', arrivalTime: 0, completionTime: null, colorClass: COLORS[6], agingCounter: 0
      });
      procs.push({
        id: 3, name: 'Mixed', priority: 3, memoryRequired: 3, memoryBlocks: [6,7,8],
        threads: [{...createThreadObj(3, 1, 6, [
          { type: 'COMPUTE', ticks: 2 }, { type: 'IO_WAIT', ticks: 4 },
          { type: 'COMPUTE', ticks: 4 }
        ]), state: 'READY'}],
        state: 'READY', arrivalTime: 0, completionTime: null, colorClass: COLORS[8], agingCounter: 0
      });
    }

    const newMem = Array(64).fill(null);
    procs.forEach(p => p.memoryBlocks.forEach(b => newMem[b] = p.id));
    
    procs.forEach(p => {
      p.pageTable = Array.from({ length: p.memoryRequired }).map((_, i) => ({
        pageId: i, frameId: p.memoryBlocks[i] ?? null, valid: p.memoryBlocks[i] !== undefined, loadTime: 0, lastAccessTime: 0
      }));
      p.pageFaults = 0; p.pageHits = 0;
    });

    processesRef.current = procs; setProcesses(procs);
    memoryRef.current = newMem; setMemory(newMem);
    nextProcessId.current = procs.length + 1;
    
    logsRef.current.unshift({ tick: 0, msg: `[System] Loaded Workload Scenario: ${type.toUpperCase()}` });
    setLogs([...logsRef.current]);
  };

  const handleReset = (newMemorySize?: number | any) => {
    const size = typeof newMemorySize === 'number' ? newMemorySize : totalMemory;
    setIsRunning(false);
    clockRef.current = 0;
    setClock(0);
    busyTicks.current = 0;
    contextSwitches.current = 0;
    processesRef.current = [];
    setProcesses([]);
    const newMemArr = Array(size).fill(null);
    setMemory(newMemArr);
    memoryRef.current = [...newMemArr];
    setGanttChart([]);
    setLogs([]);
    logsRef.current = [];
    mutexesRef.current = []; setMutexes([]);
    semaphoresRef.current = []; setSemaphores([]);
    sharedVarsRef.current = []; setSharedVars([]);
    currentQuantum.current = 0;
    nextProcessId.current = 1;
    nextQueueCounter.current = 1;
    totalPageFaultsRef.current = 0;
    totalPageHitsRef.current = 0;
  };

  const getProcessColor = (id: number) => {
    const p = processes.find(p => p.id === id);
    return p ? p.colorClass : 'bg-slate-800';
  };

  const runningProc = processes.find(p => p.threads.some(t => t.state === 'RUNNING'));
  const runningThread = runningProc?.threads.find(t => t.state === 'RUNNING');
  
  let readyThreadsDisplay: {t: Thread, p: Process}[] = [];
  processes.forEach(p => {
    p.threads.forEach(t => {
      if (t.state === 'READY') readyThreadsDisplay.push({t, p});
    });
  });
  
  if (schedulerType === 'PRIORITY') {
    readyThreadsDisplay.sort((a, b) => a.p.priority - b.p.priority || a.t.queueTime - b.t.queueTime);
  } else {
    readyThreadsDisplay.sort((a, b) => a.t.queueTime - b.t.queueTime);
  }

  const usedMemory = memory.filter(m => m !== null).length;

  const terminatedProcs = processes.filter(p => p.state === 'TERMINATED');
  let totalWT = 0;
  let totalTAT = 0;
  terminatedProcs.forEach(p => {
    const tat = p.completionTime! - p.arrivalTime;
    const totalBurst = p.threads.reduce((sum, t) => sum + t.burstTime, 0);
    const wt = tat - totalBurst;
    totalTAT += tat;
    totalWT += wt;
  });
  const avgTAT = terminatedProcs.length > 0 ? (totalTAT / terminatedProcs.length).toFixed(2) : '0.00';
  const avgWT = terminatedProcs.length > 0 ? (totalWT / terminatedProcs.length).toFixed(2) : '0.00';
  
  const cpuUtilization = clock > 0 ? ((busyTicks.current / clock) * 100).toFixed(1) : '0.0';
  const throughput = clock > 0 ? (terminatedProcs.length / clock).toFixed(3) : '0.000';
  const totalCS = contextSwitches.current;
  const hitRatio = totalPageHitsRef.current + totalPageFaultsRef.current > 0 ? 
    ((totalPageHitsRef.current / (totalPageHitsRef.current + totalPageFaultsRef.current)) * 100).toFixed(1) : '0.0';

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8 flex flex-col gap-6 max-w-[1600px] mx-auto">
      <header className="glass-panel flex flex-col md:flex-row items-center justify-between p-4 px-6 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/30 animate-pulse">
            <Activity className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">OS <span className="text-slate-500 font-normal">Kernel Simulator</span></h1>
          </div>
        </div>

        <div className="flex items-center gap-8 bg-slate-900/50 px-6 py-2 rounded-xl border border-slate-700/50">
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1 flex items-center gap-1"><Clock size={12}/> Clock</span>
            <span className="font-mono text-xl text-cyan-400">{clock} <span className="text-sm text-cyan-400/50">ticks</span></span>
          </div>
          <div className="w-px h-8 bg-slate-700"></div>
          <div className="flex flex-col items-center">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1 flex items-center gap-1"><Cpu size={12}/> CPU</span>
            <span className={`font-mono text-xl ${runningThread ? 'text-emerald-400' : 'text-slate-500'}`}>
              {runningThread ? 'BUSY' : 'IDLE'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => handleReset()} className="btn border border-red-500/50 text-red-400 hover:bg-red-500/10 flex items-center gap-2">
            <RotateCcw size={18} /> Reset
          </button>
          <button 
            onClick={() => setIsRunning(!isRunning)} 
            className={`btn flex items-center gap-2 ${isRunning ? 'btn-secondary text-red-400' : 'btn-primary'}`}
          >
            {isRunning ? <><Pause size={18} /> Pause</> : <><Play size={18} /> Start Kernel</>}
          </button>
          <button onClick={tick} disabled={isRunning} className="btn border border-cyan-500/50 text-cyan-400 hover:bg-cyan-500/10 flex items-center gap-2">
            <StepForward size={18} /> Step
          </button>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow min-h-0">
        <section className="col-span-1 lg:col-span-3 flex flex-col gap-6">
          <div className="glass-panel p-5">
            <h2 className="text-lg font-semibold mb-4 border-b border-slate-700/50/10 pb-3 flex items-center gap-2">
              <Settings size={18} className="text-cyan-400"/> OS Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Scheduler Algorithm</label>
                <select 
                  value={schedulerType} 
                  onChange={(e) => setSchedulerType(e.target.value as SchedulerType)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white"
                >
                  <option value="RR">Round Robin</option>
                  <option value="FCFS">First Come First Serve</option>
                  <option value="PRIORITY">Priority (Preemptive)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Total Memory</label>
                <select 
                  value={totalMemory} 
                  onChange={(e) => {setTotalMemory(parseInt(e.target.value)); handleReset(parseInt(e.target.value));}}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white"
                >
                  <option value="32">32 Blocks</option>
                  <option value="64">64 Blocks</option>
                  <option value="128">128 Blocks</option>
                </select>
              </div>
              
              {schedulerType === 'RR' && (
                <div className="animate-[fadeIn_0.2s_ease-out]">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Quantum (ticks)</label>
                  <input 
                    type="number" min="1" max="20" value={quantum} onChange={e => setQuantum(parseInt(e.target.value) || 1)}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white"
                  />
                </div>
              )}

              <div className="flex items-center gap-2 mb-4 bg-slate-900/30 p-2 rounded-lg border border-slate-700">
                <input 
                  type="checkbox" 
                  checked={useDemandPaging} 
                  onChange={(e) => setUseDemandPaging(e.target.checked)} 
                  className="w-4 h-4 rounded text-emerald-400 focus:ring-emerald-500 bg-slate-800 border-slate-600" 
                  id="demandPagingToggle"
                />
                <label htmlFor="demandPagingToggle" className="text-xs font-medium text-emerald-400 cursor-pointer">Enable Demand Paging</label>
              </div>

              {useDemandPaging && (
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Page Replacement Policy</label>
                  <select 
                    value={pageReplacement} 
                    onChange={(e) => setPageReplacement(e.target.value as 'LRU' | 'FIFO')}
                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white"
                  >
                    <option value="LRU">Least Recently Used (LRU)</option>
                    <option value="FIFO">First In First Out (FIFO)</option>
                  </select>
                </div>
              )}
              
              <div className="pt-2 border-t border-slate-700/50">
                <label className="block text-xs font-medium text-violet-400 mb-1 flex items-center gap-1"><Lock size={12}/> Load Sync Demo</label>
                <select 
                  onChange={(e) => { if(e.target.value) loadDemo(e.target.value); e.target.value = ''; }}
                  className="w-full bg-violet-500/20 border border-violet-500/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-400 text-white mb-3"
                  value=""
                >
                  <option value="" disabled>Select a scenario...</option>
                  <option value="race">1. Race Condition (No Sync)</option>
                  <option value="mutex">2. Mutex-Protected Counter</option>
                  <option value="prod_cons">3. Producer-Consumer (Semaphores)</option>
                </select>

                <label className="block text-xs font-medium text-cyan-400 mb-1 flex items-center gap-1"><Cpu size={12}/> Load Workload</label>
                <select 
                  onChange={(e) => { if(e.target.value) loadWorkload(e.target.value); e.target.value = ''; }}
                  className="w-full bg-cyan-900/20 border border-cyan-500/50 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-cyan-400 text-white"
                  value=""
                >
                  <option value="" disabled>Select a workload...</option>
                  <option value="cpu">1. CPU-Bound Workload</option>
                  <option value="io">2. I/O-Bound Workload</option>
                  <option value="mixed">3. Mixed Workload</option>
                </select>
              </div>
            </div>
          </div>

          <div className="glass-panel p-5 flex flex-col h-[500px]">
            <h2 className="text-lg font-semibold mb-4 border-b border-slate-700/50/10 pb-3 flex items-center gap-2">
              <Activity size={18} className="text-violet-400"/> Process Manager (PCB/TCB)
            </h2>
            
            <form onSubmit={handleAddProcess} className="mb-6 space-y-4">
               <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">T1 Burst</label>
                  <input type="number" min="1" required value={newBurst} onChange={e => setNewBurst(parseInt(e.target.value))} className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 text-white"/>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">Mem</label>
                  <input type="number" min="1" required value={newMem} onChange={e => setNewMem(parseInt(e.target.value))} className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 text-white"/>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1" title="1 is highest">Priority</label>
                  <input type="number" min="1" required value={newPriority} onChange={e => setNewPriority(parseInt(e.target.value))} className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 text-white"/>
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-slate-500 mb-1">Arrival</label>
                  <input type="number" min="0" required value={newArrival} onChange={e => setNewArrival(parseInt(e.target.value) || 0)} className="w-full bg-slate-900/50 border border-slate-700 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500 text-white"/>
                </div>
              </div>
              <button type="submit" className="btn btn-accent w-full text-xs py-2">process_create()</button>
            </form>

            <div className="flex-grow flex flex-col overflow-hidden">
              <div className="flex-grow overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                {processes.length === 0 ? (
                  <div className="text-center p-4 text-slate-500 text-sm italic border border-dashed border-slate-700 rounded-lg">No processes running.</div>
                ) : processes.map(p => (
                  <div key={p.id} className="bg-slate-900/40 border border-slate-700/50 rounded-lg p-2 relative group">
                    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-lg ${p.colorClass}`}></div>
                    <div className="flex justify-between items-start mb-2 pl-2">
                      <div>
                        <span className="font-bold text-sm">PID {p.id}</span>
                        <div className="text-[10px] text-slate-500">Prio: {p.priority} | Mem: {p.memoryRequired}</div>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">{p.state}</span>
                    </div>
                    
                    <div className="pl-2 space-y-1">
                      {p.pageTable && p.pageTable.length > 0 && (
                        <div className="mb-2 grid grid-cols-4 gap-1">
                          {p.pageTable.map(pte => (
                            <div key={pte.pageId} className={`text-[8px] text-center border rounded py-0.5 ${pte.valid ? 'bg-emerald-900/30 border-emerald-500/50 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`} title={pte.valid ? `Loaded at Tick ${pte.loadTime}, Last Accessed Tick ${pte.lastAccessTime}` : 'In Swap Space'}>
                              P{pte.pageId}:{pte.valid ? `F${pte.frameId}` : 'SWP'}
                            </div>
                          ))}
                        </div>
                      )}
                      {p.threads.map(t => (
                        <div key={t.tid} className={`bg-slate-900/80 rounded p-1.5 flex flex-col border ${t.state==='RUNNING' ? 'border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'border-slate-700/50'}`}>
                           <div className="flex justify-between items-center w-full">
                             <div className="text-xs font-mono text-cyan-400 flex items-center gap-1">
                               {t.tid} 
                               <span className={`text-[9px] px-1 rounded ${t.state === 'WAITING' ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-900 text-slate-500'}`}>{t.state}</span>
                             </div>
                             <div className="text-[10px] text-slate-500 font-mono">T:{t.remainingTime}/{t.burstTime}</div>
                           </div>
                           <div className="flex gap-1 mt-1.5 w-full justify-end">
                             <button onClick={() => handleTriggerIO(t.tid)} disabled={t.state === 'TERMINATED' || t.state === 'WAITING'} className="text-[9px] bg-slate-700 hover:bg-slate-600 px-1.5 py-0.5 rounded text-white disabled:opacity-50">I/O Wait</button>
                             <button onClick={() => handleThreadJoin(t.tid)} disabled={t.state === 'TERMINATED' || t.state === 'WAITING'} className="text-[9px] bg-indigo-900 hover:bg-indigo-800 px-1.5 py-0.5 rounded text-white disabled:opacity-50">Join()</button>
                           </div>
                        </div>
                      ))}
                      {p.state !== 'TERMINATED' && (
                        <button onClick={() => handleAddThread(p.id)} className="w-full mt-1 text-[10px] border border-dashed border-slate-700/50 text-slate-500 hover:text-white hover:border-slate-400 py-1 rounded bg-slate-800/30">
                          + thread_create()
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="glass-panel col-span-1 lg:col-span-5 p-5 flex flex-col h-[850px]">
          <h2 className="text-lg font-semibold mb-4 border-b border-slate-700/50/10 pb-3 flex items-center gap-2">
            <Cpu size={18} className="text-emerald-400"/> CPU Scheduler (Hardware Context)
            <span className="text-xs font-normal text-slate-500 ml-auto bg-slate-900/50 px-2 py-1 rounded border border-slate-700">
              {schedulerType === 'RR' ? 'Round Robin' : schedulerType === 'FCFS' ? 'FCFS' : 'Priority'}
            </span>
          </h2>
          
          <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-5 text-center mb-6 relative overflow-hidden group">
            <div className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-3">Executing Thread</div>
            
            {runningThread ? (
              <div className="bg-gradient-to-br from-emerald-900/40 to-slate-800 border border-emerald-500/30 p-4 rounded-lg shadow-[0_0_20px_rgba(16,185,129,0.15)] transform transition-all scale-105">
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${runningThread.colorClass} animate-pulse`}></div>
                    <span className="text-lg font-bold text-white">{runningThread.tid}</span>
                  </div>
                  <span className="font-mono text-emerald-400 font-bold text-lg">{runningThread.remainingTime}s left</span>
                </div>
                
                {/* CPU Context Registers */}
                <div className="grid grid-cols-4 gap-2 text-center text-xs font-mono bg-slate-900/50 p-2 rounded border border-slate-700/50 mt-2 mb-3 shadow-inner">
                  <div className="flex flex-col"><span className="text-slate-500 text-[9px]">PC</span><span className="text-emerald-400">{runningThread.context.pc}</span></div>
                  <div className="flex flex-col"><span className="text-slate-500 text-[9px]">SP</span><span className="text-cyan-400">{runningThread.context.sp}</span></div>
                  <div className="flex flex-col"><span className="text-slate-500 text-[9px]">R1 (Reg)</span><span className="text-amber-400">{runningThread.context.r1}</span></div>
                  <div className="flex flex-col"><span className="text-slate-500 text-[9px]">R2</span><span className="text-amber-400">{runningThread.context.r2}</span></div>
                </div>

                <div className="w-full bg-slate-900 rounded-full h-1.5 mt-2 overflow-hidden border border-slate-700">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-300" 
                    style={{ width: `${((runningThread.burstTime - runningThread.remainingTime) / runningThread.burstTime) * 100}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 mt-2 uppercase font-semibold">
                  <span>{schedulerType === 'RR' ? `Quantum: ${currentQuantum.current}/${quantum}` : `Priority: ${runningProc?.priority}`}</span>
                  <span>PID {runningProc?.id}</span>
                </div>
              </div>
            ) : (
              <div className="h-[148px] flex flex-col items-center justify-center border-2 border-dashed border-slate-700 rounded-lg bg-slate-900/30">
                <Cpu size={32} className="text-slate-500 mb-2" />
                <span className="text-slate-500 font-mono tracking-widest">CPU IDLE</span>
              </div>
            )}
          </div>

          <div className="flex-grow flex flex-col">
            <div className="flex justify-between items-end mb-3">
              <h3 className="text-sm font-medium text-slate-500">Ready Queue (TCBs)</h3>
              <span className="text-xs bg-blue-500/20 text-cyan-400 px-2 py-0.5 rounded-full">{readyThreadsDisplay.length} Waiting</span>
            </div>
            
            <div className="flex-grow bg-slate-900/30 border border-slate-700/50 rounded-xl p-3 flex flex-wrap gap-2 content-start overflow-y-auto">
              {readyThreadsDisplay.length === 0 ? (
                <div className="w-full text-center p-4 text-slate-500 text-sm italic">Queue is empty.</div>
              ) : readyThreadsDisplay.map(({t, p}, idx) => (
                <div key={t.tid} className="bg-slate-800 border border-blue-500/30 p-2 rounded-lg shadow-md w-[calc(33.33%-0.35rem)] flex flex-col animate-[fadeIn_0.3s_ease-out] relative">
                  {idx === 0 && <div className="absolute -top-1 -right-1 flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span></div>}
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className={`w-2 h-2 rounded-full ${t.colorClass}`}></div>
                    <span className="font-semibold text-xs truncate text-cyan-300">{t.tid}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>T:{t.remainingTime}</span>
                    <span className="text-violet-400">Prio:{p.priority}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Synchronization View */}
          {(mutexes.length > 0 || semaphores.length > 0 || sharedVars.length > 0) && (
            <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-4 mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
               {sharedVars.length > 0 && (
                 <div>
                   <h4 className="text-xs text-slate-500 font-semibold mb-2">Shared Variables</h4>
                   <div className="space-y-2">
                     {sharedVars.map(v => (
                       <div key={v.id} className="bg-slate-800 p-2 rounded flex justify-between border border-slate-700 text-xs shadow-inner">
                         <span>{v.name}</span>
                         <span className="font-mono text-cyan-400 font-bold">{v.value}</span>
                       </div>
                     ))}
                   </div>
                 </div>
               )}
               {mutexes.length > 0 && (
                 <div>
                   <h4 className="text-xs text-slate-500 font-semibold mb-2">Mutexes</h4>
                   <div className="space-y-2">
                     {mutexes.map(m => (
                       <div key={m.id} className={`p-2 rounded flex flex-col border text-xs shadow-inner ${m.isLocked ? 'bg-rose-900/20 border-rose-500/50' : 'bg-slate-800 border-emerald-500/50'}`}>
                         <div className="flex justify-between font-mono">
                           <span>{m.name}</span>
                           <span>{m.isLocked ? <span className="text-rose-400">LOCKED ({m.ownerTid})</span> : <span className="text-emerald-400">UNLOCKED</span>}</span>
                         </div>
                         {m.waitQueue.length > 0 && (
                           <div className="text-[10px] text-amber-400/80 mt-1">Wait Queue: {m.waitQueue.join(', ')}</div>
                         )}
                       </div>
                     ))}
                   </div>
                 </div>
               )}
               {semaphores.length > 0 && (
                 <div>
                   <h4 className="text-xs text-slate-500 font-semibold mb-2">Semaphores</h4>
                   <div className="space-y-2">
                     {semaphores.map(s => (
                       <div key={s.id} className="bg-slate-800 p-2 rounded flex flex-col border border-slate-700 text-xs shadow-inner">
                         <div className="flex justify-between font-mono">
                           <span>{s.name}</span>
                           <span className="text-cyan-400 font-bold">Count: {s.counter}</span>
                         </div>
                         {s.waitQueue.length > 0 && (
                           <div className="text-[10px] text-amber-400/80 mt-1">Wait Queue: {s.waitQueue.join(', ')}</div>
                         )}
                       </div>
                     ))}
                   </div>
                 </div>
               )}
            </div>
          )}
        </section>

        <section className="col-span-1 lg:col-span-4 flex flex-col gap-6">
          <div className="glass-panel p-5 flex flex-col h-[326px] overflow-hidden">
            <h2 className="text-lg font-semibold mb-4 border-b border-slate-700/50/10 pb-3 flex items-center gap-2">
              <MemoryStick size={18} className="text-cyan-400"/> Physical Memory
            </h2>
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-slate-500">Utilization</span>
                <span className="font-mono font-medium text-cyan-400">{usedMemory} / {totalMemory} Blocks</span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700/50">
                <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500" style={{ width: `${(usedMemory / totalMemory) * 100}%` }}></div>
              </div>
            </div>
            <div className="flex-grow bg-slate-900/50 border border-slate-700/50 rounded-xl p-3 flex flex-col overflow-y-auto custom-scrollbar">
               <div className="grid gap-1 flex-grow content-start" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${totalMemory > 64 ? '20px' : '30px'}, 1fr))` }}>
                 {memory.map((processId, index) => (
                   <div key={index} className={`aspect-square rounded-[4px] border flex items-center justify-center text-[8px] font-mono transition-all duration-200 cursor-help relative group ${processId !== null ? getProcessColor(processId) + ' shadow-inner border-slate-700/50/20 hover:scale-110 hover:z-10 text-white' : 'border-slate-700/50/5 bg-slate-800 hover:bg-slate-900'}`}>
                     {processId !== null ? `P${processId}` : ''}
                     {processId !== null && (
                       <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-20">
                         Frame {index} (PID: {processId})
                       </div>
                     )}
                   </div>
                 ))}
               </div>
            </div>
          </div>

          <div className="glass-panel p-5 flex flex-col h-[500px]">
            <h2 className="text-lg font-semibold mb-4 border-b border-slate-700/50/10 pb-3 flex items-center gap-2">
              <TerminalSquare size={18} className="text-amber-400"/> System Events Log
            </h2>
            <div className="flex-grow bg-slate-950 border border-slate-700/50 rounded-xl p-3 overflow-y-auto custom-scrollbar flex flex-col gap-1.5 shadow-inner">
              {logs.length === 0 ? (
                <div className="text-center p-4 text-slate-500 text-sm italic font-mono">Awaiting Kernel Events...</div>
              ) : logs.map((log, i) => (
                <div key={i} className="text-[11px] font-mono text-slate-300 border-b border-slate-800/50 pb-1.5 mb-0.5 leading-tight">
                  <span className="text-cyan-300 mr-2">[{log.tick.toString().padStart(4, '0')}]</span>
                  {log.msg.includes('process_context_switch') ? <span className="text-amber-400">{log.msg}</span> :
                   log.msg.includes('TERMINATED') ? <span className="text-rose-400">{log.msg}</span> :
                   log.msg.includes('thread_create') ? <span className="text-emerald-400">{log.msg}</span> :
                   log.msg.includes('WAITING') || log.msg.includes('joined') || log.msg.includes('BLOCKED') ? <span className="text-indigo-400">{log.msg}</span> :
                   log.msg.includes('Acquired') || log.msg.includes('Released') || log.msg.includes('Signaled') ? <span className="text-fuchsia-400">{log.msg}</span> :
                   log.msg.includes('SWAPPED OUT') ? <span className="text-orange-400 font-bold bg-orange-900/20 px-1 rounded">{log.msg}</span> :
                   log.msg.includes('SWAPPED IN') ? <span className="text-emerald-400 font-bold bg-teal-900/20 px-1 rounded">{log.msg}</span> :
                   log.msg.includes('PAGE FAULT') ? <span className="text-red-400 font-semibold">{log.msg}</span> :
                   <span>{log.msg}</span>}
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Bottom Panel: Analytics & Gantt */}
      <section className="glass-panel p-5 mb-8 flex flex-col gap-4">
        <h2 className="text-lg font-semibold border-b border-slate-700/50/10 pb-3 flex items-center gap-2">
          <Activity size={18} className="text-rose-400"/> System Analytics & Execution Trace
        </h2>
        
        <div className="flex flex-col xl:flex-row gap-6 min-w-0 w-full">
          <div className="flex flex-wrap gap-4 xl:w-[350px] content-start">
            <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-3 flex flex-col items-center justify-center min-w-[150px] flex-1 shadow-inner">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1 text-center">Avg Wait Time</span>
              <span className="text-2xl font-mono text-rose-400 font-bold mt-1">{avgWT} <span className="text-sm font-normal text-rose-400/50">ticks</span></span>
            </div>
            <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-3 flex flex-col items-center justify-center min-w-[150px] flex-1 shadow-inner">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1 text-center">Avg Turnaround</span>
              <span className="text-2xl font-mono text-fuchsia-400 font-bold mt-1">{avgTAT} <span className="text-sm font-normal text-fuchsia-400/50">ticks</span></span>
            </div>
            <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-3 flex flex-col items-center justify-center min-w-[150px] flex-1 shadow-inner">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1 text-center">CPU Util</span>
              <span className="text-2xl font-mono text-emerald-400 font-bold mt-1">{cpuUtilization}<span className="text-sm font-normal text-emerald-400/50">%</span></span>
            </div>
            <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-3 flex flex-col items-center justify-center min-w-[150px] flex-1 shadow-inner">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1 text-center">Throughput</span>
              <span className="text-2xl font-mono text-cyan-400 font-bold mt-1">{throughput}</span>
            </div>
            <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-3 flex flex-col items-center justify-center min-w-[150px] flex-1 shadow-inner">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1 text-center">Hit Ratio</span>
              <span className="text-2xl font-mono text-cyan-400 font-bold mt-1">{hitRatio}<span className="text-sm font-normal text-cyan-400/50">%</span></span>
            </div>
            <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-3 flex flex-col items-center justify-center min-w-[150px] flex-1 shadow-inner">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1 text-center">Page Faults</span>
              <span className="text-2xl font-mono text-rose-400 font-bold mt-1">{totalPageFaultsRef.current}</span>
            </div>
            <div className="bg-slate-900/50 border border-slate-700 rounded-xl p-3 flex flex-col items-center justify-center w-full shadow-inner">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1 text-center">Context Switches</span>
              <span className="text-2xl font-mono text-amber-400 font-bold mt-1">{totalCS}</span>
            </div>
          </div>

          <div className="flex-grow flex flex-col min-w-0 w-full">
            <h3 className="text-sm font-medium text-slate-500 mb-2">Thread Execution Gantt Chart</h3>
            <div className="flex-grow bg-slate-900/80 border border-slate-700 rounded-xl flex items-center p-4 min-h-[120px] shadow-inner relative min-w-0 w-full overflow-hidden">
              {ganttChart.length === 0 ? (
                <div className="w-full text-center text-slate-500 text-sm font-mono">Waiting for execution...</div>
              ) : (
                <div 
                  ref={ganttContainerRef}
                  className="flex w-full h-28 items-start pt-5 px-6 relative overflow-x-auto overflow-y-hidden rounded-lg border border-slate-700/50 [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-track]:bg-slate-900/50 [&::-webkit-scrollbar-track]:rounded-b-lg [&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-thumb]:rounded-full pb-2"
                >
                  {ganttChart.map((block, idx) => (
                    <div 
                      key={idx} 
                      className={`h-12 flex flex-col justify-center items-center border-r border-slate-900/50 flex-shrink-0 relative group shadow-md transition-transform hover:scale-110 hover:z-30 cursor-crosshair rounded-sm ${block.pid ? getProcessColor(block.pid) : 'bg-slate-800'}`} 
                      style={{ width: `${Math.max(40, (block.endTick - block.startTick) * 30)}px` }}
                    >
                      <span className="text-sm font-bold text-white/90 drop-shadow-md z-10">
                        {block.tid ? block.tid : 'IDLE'}
                      </span>
                      <div className="absolute -bottom-7 text-[10px] text-slate-500 font-mono left-0 -translate-x-1/2">{block.startTick}</div>
                      {idx === ganttChart.length - 1 && (
                         <div className="absolute -bottom-7 text-[10px] text-slate-500 font-mono right-0 translate-x-1/2">{block.endTick}</div>
                      )}
                      
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-black text-slate-800 text-[11px] px-3 py-1.5 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-40 shadow-lg border border-slate-700/50/10">
                        <span className="text-cyan-400 font-bold">{block.tid ? block.tid : 'CPU IDLE'}</span> <br/>
                        Start: {block.startTick} | End: {block.endTick} <br/>
                        Duration: {block.endTick - block.startTick} ticks
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer { 100% { transform: translateX(100%); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }
      `}} />
    </div>
  );
}
