# CMAKE generated file: DO NOT EDIT!
# Generated by "MSYS Makefiles" Generator, CMake Version 3.14

# Delete rule output on recipe failure.
.DELETE_ON_ERROR:


#=============================================================================
# Special targets provided by cmake.

# Disable implicit rules so canonical targets will work.
.SUFFIXES:


# Remove some rules from gmake that .SUFFIXES does not remove.
SUFFIXES =

.SUFFIXES: .hpux_make_needs_suffix_list


# Suppress display of executed commands.
$(VERBOSE).SILENT:


# A target that is always out of date.
cmake_force:

.PHONY : cmake_force

#=============================================================================
# Set environment variables for the build.

# The shell in which to execute make rules.
SHELL = /bin/sh

# The CMake executable.
CMAKE_COMMAND = /X/tools/cmake/bin/cmake.exe

# The command to remove a file.
RM = /X/tools/cmake/bin/cmake.exe -E remove -f

# Escaping for special characters.
EQUALS = =

# The top-level source directory on which CMake was run.
CMAKE_SOURCE_DIR = /X/tools/luapower-full/csrc/libjpeg/src

# The top-level build directory on which CMake was run.
CMAKE_BINARY_DIR = /X/tools/luapower-full/csrc/libjpeg/src

# Include any dependencies generated for this target.
include sharedlib/CMakeFiles/cjpeg.dir/depend.make

# Include the progress variables for this target.
include sharedlib/CMakeFiles/cjpeg.dir/progress.make

# Include the compile flags for this target's objects.
include sharedlib/CMakeFiles/cjpeg.dir/flags.make

sharedlib/CMakeFiles/cjpeg.dir/__/cjpeg.c.obj: sharedlib/CMakeFiles/cjpeg.dir/flags.make
sharedlib/CMakeFiles/cjpeg.dir/__/cjpeg.c.obj: sharedlib/CMakeFiles/cjpeg.dir/includes_C.rsp
sharedlib/CMakeFiles/cjpeg.dir/__/cjpeg.c.obj: cjpeg.c
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green --progress-dir=/X/tools/luapower-full/csrc/libjpeg/src/CMakeFiles --progress-num=$(CMAKE_PROGRESS_1) "Building C object sharedlib/CMakeFiles/cjpeg.dir/__/cjpeg.c.obj"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -o CMakeFiles/cjpeg.dir/__/cjpeg.c.obj   -c /X/tools/luapower-full/csrc/libjpeg/src/cjpeg.c

sharedlib/CMakeFiles/cjpeg.dir/__/cjpeg.c.i: cmake_force
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green "Preprocessing C source to CMakeFiles/cjpeg.dir/__/cjpeg.c.i"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -E /X/tools/luapower-full/csrc/libjpeg/src/cjpeg.c > CMakeFiles/cjpeg.dir/__/cjpeg.c.i

sharedlib/CMakeFiles/cjpeg.dir/__/cjpeg.c.s: cmake_force
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green "Compiling C source to assembly CMakeFiles/cjpeg.dir/__/cjpeg.c.s"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -S /X/tools/luapower-full/csrc/libjpeg/src/cjpeg.c -o CMakeFiles/cjpeg.dir/__/cjpeg.c.s

sharedlib/CMakeFiles/cjpeg.dir/__/cdjpeg.c.obj: sharedlib/CMakeFiles/cjpeg.dir/flags.make
sharedlib/CMakeFiles/cjpeg.dir/__/cdjpeg.c.obj: sharedlib/CMakeFiles/cjpeg.dir/includes_C.rsp
sharedlib/CMakeFiles/cjpeg.dir/__/cdjpeg.c.obj: cdjpeg.c
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green --progress-dir=/X/tools/luapower-full/csrc/libjpeg/src/CMakeFiles --progress-num=$(CMAKE_PROGRESS_2) "Building C object sharedlib/CMakeFiles/cjpeg.dir/__/cdjpeg.c.obj"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -o CMakeFiles/cjpeg.dir/__/cdjpeg.c.obj   -c /X/tools/luapower-full/csrc/libjpeg/src/cdjpeg.c

sharedlib/CMakeFiles/cjpeg.dir/__/cdjpeg.c.i: cmake_force
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green "Preprocessing C source to CMakeFiles/cjpeg.dir/__/cdjpeg.c.i"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -E /X/tools/luapower-full/csrc/libjpeg/src/cdjpeg.c > CMakeFiles/cjpeg.dir/__/cdjpeg.c.i

sharedlib/CMakeFiles/cjpeg.dir/__/cdjpeg.c.s: cmake_force
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green "Compiling C source to assembly CMakeFiles/cjpeg.dir/__/cdjpeg.c.s"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -S /X/tools/luapower-full/csrc/libjpeg/src/cdjpeg.c -o CMakeFiles/cjpeg.dir/__/cdjpeg.c.s

sharedlib/CMakeFiles/cjpeg.dir/__/rdgif.c.obj: sharedlib/CMakeFiles/cjpeg.dir/flags.make
sharedlib/CMakeFiles/cjpeg.dir/__/rdgif.c.obj: sharedlib/CMakeFiles/cjpeg.dir/includes_C.rsp
sharedlib/CMakeFiles/cjpeg.dir/__/rdgif.c.obj: rdgif.c
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green --progress-dir=/X/tools/luapower-full/csrc/libjpeg/src/CMakeFiles --progress-num=$(CMAKE_PROGRESS_3) "Building C object sharedlib/CMakeFiles/cjpeg.dir/__/rdgif.c.obj"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -o CMakeFiles/cjpeg.dir/__/rdgif.c.obj   -c /X/tools/luapower-full/csrc/libjpeg/src/rdgif.c

sharedlib/CMakeFiles/cjpeg.dir/__/rdgif.c.i: cmake_force
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green "Preprocessing C source to CMakeFiles/cjpeg.dir/__/rdgif.c.i"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -E /X/tools/luapower-full/csrc/libjpeg/src/rdgif.c > CMakeFiles/cjpeg.dir/__/rdgif.c.i

sharedlib/CMakeFiles/cjpeg.dir/__/rdgif.c.s: cmake_force
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green "Compiling C source to assembly CMakeFiles/cjpeg.dir/__/rdgif.c.s"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -S /X/tools/luapower-full/csrc/libjpeg/src/rdgif.c -o CMakeFiles/cjpeg.dir/__/rdgif.c.s

sharedlib/CMakeFiles/cjpeg.dir/__/rdppm.c.obj: sharedlib/CMakeFiles/cjpeg.dir/flags.make
sharedlib/CMakeFiles/cjpeg.dir/__/rdppm.c.obj: sharedlib/CMakeFiles/cjpeg.dir/includes_C.rsp
sharedlib/CMakeFiles/cjpeg.dir/__/rdppm.c.obj: rdppm.c
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green --progress-dir=/X/tools/luapower-full/csrc/libjpeg/src/CMakeFiles --progress-num=$(CMAKE_PROGRESS_4) "Building C object sharedlib/CMakeFiles/cjpeg.dir/__/rdppm.c.obj"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -o CMakeFiles/cjpeg.dir/__/rdppm.c.obj   -c /X/tools/luapower-full/csrc/libjpeg/src/rdppm.c

sharedlib/CMakeFiles/cjpeg.dir/__/rdppm.c.i: cmake_force
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green "Preprocessing C source to CMakeFiles/cjpeg.dir/__/rdppm.c.i"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -E /X/tools/luapower-full/csrc/libjpeg/src/rdppm.c > CMakeFiles/cjpeg.dir/__/rdppm.c.i

sharedlib/CMakeFiles/cjpeg.dir/__/rdppm.c.s: cmake_force
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green "Compiling C source to assembly CMakeFiles/cjpeg.dir/__/rdppm.c.s"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -S /X/tools/luapower-full/csrc/libjpeg/src/rdppm.c -o CMakeFiles/cjpeg.dir/__/rdppm.c.s

sharedlib/CMakeFiles/cjpeg.dir/__/rdswitch.c.obj: sharedlib/CMakeFiles/cjpeg.dir/flags.make
sharedlib/CMakeFiles/cjpeg.dir/__/rdswitch.c.obj: sharedlib/CMakeFiles/cjpeg.dir/includes_C.rsp
sharedlib/CMakeFiles/cjpeg.dir/__/rdswitch.c.obj: rdswitch.c
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green --progress-dir=/X/tools/luapower-full/csrc/libjpeg/src/CMakeFiles --progress-num=$(CMAKE_PROGRESS_5) "Building C object sharedlib/CMakeFiles/cjpeg.dir/__/rdswitch.c.obj"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -o CMakeFiles/cjpeg.dir/__/rdswitch.c.obj   -c /X/tools/luapower-full/csrc/libjpeg/src/rdswitch.c

sharedlib/CMakeFiles/cjpeg.dir/__/rdswitch.c.i: cmake_force
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green "Preprocessing C source to CMakeFiles/cjpeg.dir/__/rdswitch.c.i"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -E /X/tools/luapower-full/csrc/libjpeg/src/rdswitch.c > CMakeFiles/cjpeg.dir/__/rdswitch.c.i

sharedlib/CMakeFiles/cjpeg.dir/__/rdswitch.c.s: cmake_force
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green "Compiling C source to assembly CMakeFiles/cjpeg.dir/__/rdswitch.c.s"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -S /X/tools/luapower-full/csrc/libjpeg/src/rdswitch.c -o CMakeFiles/cjpeg.dir/__/rdswitch.c.s

sharedlib/CMakeFiles/cjpeg.dir/__/rdbmp.c.obj: sharedlib/CMakeFiles/cjpeg.dir/flags.make
sharedlib/CMakeFiles/cjpeg.dir/__/rdbmp.c.obj: sharedlib/CMakeFiles/cjpeg.dir/includes_C.rsp
sharedlib/CMakeFiles/cjpeg.dir/__/rdbmp.c.obj: rdbmp.c
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green --progress-dir=/X/tools/luapower-full/csrc/libjpeg/src/CMakeFiles --progress-num=$(CMAKE_PROGRESS_6) "Building C object sharedlib/CMakeFiles/cjpeg.dir/__/rdbmp.c.obj"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -o CMakeFiles/cjpeg.dir/__/rdbmp.c.obj   -c /X/tools/luapower-full/csrc/libjpeg/src/rdbmp.c

sharedlib/CMakeFiles/cjpeg.dir/__/rdbmp.c.i: cmake_force
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green "Preprocessing C source to CMakeFiles/cjpeg.dir/__/rdbmp.c.i"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -E /X/tools/luapower-full/csrc/libjpeg/src/rdbmp.c > CMakeFiles/cjpeg.dir/__/rdbmp.c.i

sharedlib/CMakeFiles/cjpeg.dir/__/rdbmp.c.s: cmake_force
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green "Compiling C source to assembly CMakeFiles/cjpeg.dir/__/rdbmp.c.s"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -S /X/tools/luapower-full/csrc/libjpeg/src/rdbmp.c -o CMakeFiles/cjpeg.dir/__/rdbmp.c.s

sharedlib/CMakeFiles/cjpeg.dir/__/rdtarga.c.obj: sharedlib/CMakeFiles/cjpeg.dir/flags.make
sharedlib/CMakeFiles/cjpeg.dir/__/rdtarga.c.obj: sharedlib/CMakeFiles/cjpeg.dir/includes_C.rsp
sharedlib/CMakeFiles/cjpeg.dir/__/rdtarga.c.obj: rdtarga.c
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green --progress-dir=/X/tools/luapower-full/csrc/libjpeg/src/CMakeFiles --progress-num=$(CMAKE_PROGRESS_7) "Building C object sharedlib/CMakeFiles/cjpeg.dir/__/rdtarga.c.obj"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -o CMakeFiles/cjpeg.dir/__/rdtarga.c.obj   -c /X/tools/luapower-full/csrc/libjpeg/src/rdtarga.c

sharedlib/CMakeFiles/cjpeg.dir/__/rdtarga.c.i: cmake_force
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green "Preprocessing C source to CMakeFiles/cjpeg.dir/__/rdtarga.c.i"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -E /X/tools/luapower-full/csrc/libjpeg/src/rdtarga.c > CMakeFiles/cjpeg.dir/__/rdtarga.c.i

sharedlib/CMakeFiles/cjpeg.dir/__/rdtarga.c.s: cmake_force
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green "Compiling C source to assembly CMakeFiles/cjpeg.dir/__/rdtarga.c.s"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe $(C_DEFINES) $(C_INCLUDES) $(C_FLAGS) -S /X/tools/luapower-full/csrc/libjpeg/src/rdtarga.c -o CMakeFiles/cjpeg.dir/__/rdtarga.c.s

# Object files for target cjpeg
cjpeg_OBJECTS = \
"CMakeFiles/cjpeg.dir/__/cjpeg.c.obj" \
"CMakeFiles/cjpeg.dir/__/cdjpeg.c.obj" \
"CMakeFiles/cjpeg.dir/__/rdgif.c.obj" \
"CMakeFiles/cjpeg.dir/__/rdppm.c.obj" \
"CMakeFiles/cjpeg.dir/__/rdswitch.c.obj" \
"CMakeFiles/cjpeg.dir/__/rdbmp.c.obj" \
"CMakeFiles/cjpeg.dir/__/rdtarga.c.obj"

# External object files for target cjpeg
cjpeg_EXTERNAL_OBJECTS =

cjpeg.exe: sharedlib/CMakeFiles/cjpeg.dir/__/cjpeg.c.obj
cjpeg.exe: sharedlib/CMakeFiles/cjpeg.dir/__/cdjpeg.c.obj
cjpeg.exe: sharedlib/CMakeFiles/cjpeg.dir/__/rdgif.c.obj
cjpeg.exe: sharedlib/CMakeFiles/cjpeg.dir/__/rdppm.c.obj
cjpeg.exe: sharedlib/CMakeFiles/cjpeg.dir/__/rdswitch.c.obj
cjpeg.exe: sharedlib/CMakeFiles/cjpeg.dir/__/rdbmp.c.obj
cjpeg.exe: sharedlib/CMakeFiles/cjpeg.dir/__/rdtarga.c.obj
cjpeg.exe: sharedlib/CMakeFiles/cjpeg.dir/build.make
cjpeg.exe: libjpeg.dll.a
cjpeg.exe: sharedlib/CMakeFiles/cjpeg.dir/linklibs.rsp
cjpeg.exe: sharedlib/CMakeFiles/cjpeg.dir/objects1.rsp
	@$(CMAKE_COMMAND) -E cmake_echo_color --switch=$(COLOR) --green --bold --progress-dir=/X/tools/luapower-full/csrc/libjpeg/src/CMakeFiles --progress-num=$(CMAKE_PROGRESS_8) "Linking C executable ../cjpeg.exe"
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/cmake/bin/cmake.exe -E remove -f CMakeFiles/cjpeg.dir/objects.a
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/ar.exe cr CMakeFiles/cjpeg.dir/objects.a @CMakeFiles/cjpeg.dir/objects1.rsp
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && /X/tools/mingw64/bin/gcc.exe -O3 -DNDEBUG   -Wl,--whole-archive CMakeFiles/cjpeg.dir/objects.a -Wl,--no-whole-archive  -o ../cjpeg.exe -Wl,--out-implib,../libcjpeg.dll.a -Wl,--major-image-version,0,--minor-image-version,0 @CMakeFiles/cjpeg.dir/linklibs.rsp

# Rule to build all files generated by this target.
sharedlib/CMakeFiles/cjpeg.dir/build: cjpeg.exe

.PHONY : sharedlib/CMakeFiles/cjpeg.dir/build

sharedlib/CMakeFiles/cjpeg.dir/clean:
	cd /X/tools/luapower-full/csrc/libjpeg/src/sharedlib && $(CMAKE_COMMAND) -P CMakeFiles/cjpeg.dir/cmake_clean.cmake
.PHONY : sharedlib/CMakeFiles/cjpeg.dir/clean

sharedlib/CMakeFiles/cjpeg.dir/depend:
	$(CMAKE_COMMAND) -E cmake_depends "MSYS Makefiles" /X/tools/luapower-full/csrc/libjpeg/src /X/tools/luapower-full/csrc/libjpeg/src/sharedlib /X/tools/luapower-full/csrc/libjpeg/src /X/tools/luapower-full/csrc/libjpeg/src/sharedlib /X/tools/luapower-full/csrc/libjpeg/src/sharedlib/CMakeFiles/cjpeg.dir/DependInfo.cmake --color=$(COLOR)
.PHONY : sharedlib/CMakeFiles/cjpeg.dir/depend

