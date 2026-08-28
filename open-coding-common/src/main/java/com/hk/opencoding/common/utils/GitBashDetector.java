package com.hk.opencoding.common.utils;

import com.hk.opencoding.common.enums.OperationSystem;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/**
 * Shell检测工具类
 */

public class GitBashDetector {

    /**
     * 获取 Git‑Bash bash.exe 完整路径，仅Windows需要
     * @return bash.exe绝对路径；找不到返回null
     */
    public static String detectGitBash(OperationSystem osEnum) {
        if (osEnum != OperationSystem.WINDOWS) {
            return null;
        }

        // 1. 首选：注册表读取 GitForWindows InstallPath
        String regPath = readGitInstallFromRegistry();
        if (regPath != null) {
            Path bash = Path.of(regPath.trim(), "bin", "bash.exe");
            if (Files.isRegularFile(bash)) {
                return bash.toAbsolutePath().toString();
            }
        }

        // 2. 兜底1：git --exec‑path 反推
        String byExecPath = detectByGitExecPath();
        if (byExecPath != null) {
            return byExecPath;
        }

        // 3. 兜底2：where git 反推
        return detectByWhereGit();
    }

    /**
     * 读取注册表 HKLM\SOFTWARE\GitForWindows InstallPath
     */
    private static String readGitInstallFromRegistry() {
        List<String> cmd = List.of(
                "cmd.exe", "/c",
                "reg query \"HKLM\\SOFTWARE\\GitForWindows\" /v InstallPath 2>nul"
        );
        try {
            ProcessBuilder pb = new ProcessBuilder(cmd);
            Process proc = pb.start();
            try (BufferedReader br = new BufferedReader(new InputStreamReader(proc.getInputStream()))) {
                String line;
                while ((line = br.readLine()) != null) {
                    line = line.trim();
                    if (line.contains("InstallPath") && line.contains("REG_SZ")) {
                        int idx = line.indexOf("REG_SZ");
                        if (idx != -1) {
                            String val = line.substring(idx + "REG_SZ".length()).trim();
                            if (!val.isBlank()) {
                                return val;
                            }
                        }
                    }
                }
            }
            proc.waitFor();
        } catch (IOException | InterruptedException ignored) {
        }
        return null;
    }

    /**
     * git --exec-path 反推 bin/bash.exe
     */
    private static String detectByGitExecPath() {
        try {
            Process p = new ProcessBuilder("git", "--exec-path").start();
            String output;
            try (BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                output = br.readLine();
            }
            if (p.waitFor() != 0 || output == null || output.isBlank()) {
                return null;
            }
            Path gitCore = Path.of(output.trim());
            Path gitRoot = gitCore.getParent().getParent();
            Path bash = gitRoot.resolve("bin/bash.exe");
            if (Files.isRegularFile(bash)) {
                return bash.toAbsolutePath().toString();
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    /**
     * where git 获取git.exe路径，向上回溯得到bash.exe
     */
    private static String detectByWhereGit() {
        List<String> cmd = List.of("cmd.exe", "/c", "where git 2>nul");
        try {
            Process p = new ProcessBuilder(cmd).start();
            String firstLine;
            try (BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                firstLine = br.readLine();
            }
            if (p.waitFor() != 0 || firstLine == null || firstLine.isBlank()) {
                return null;
            }
            Path gitExe = Path.of(firstLine.trim());
            Path gitRoot = gitExe.getParent().getParent();
            Path bash = gitRoot.resolve("bin/bash.exe");
            if (Files.isRegularFile(bash)) {
                return bash.toAbsolutePath().toString();
            }
        } catch (Exception ignored) {
        }
        return null;
    }
}
