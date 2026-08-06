import sys
import importlib
import run_demo

def main():
    # Import and compile check
    import processor
    importlib.reload(processor)
    # Run demo (already asserts internally)
    run_demo.main()
    print("All tests passed.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
