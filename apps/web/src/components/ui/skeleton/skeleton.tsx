const Skeleton = ({ className = "" }: { className?: string }) => {
  return <span aria-hidden className={`block animate-shimmer rounded-md bg-subtle ${className}`} />;
};

export default Skeleton;
